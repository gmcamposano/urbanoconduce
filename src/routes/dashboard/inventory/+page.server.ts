import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getInventoryStock } from '$lib/server/inventory';

function canManageCatalog(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const [{ data: items, error }, { data: models }] = await Promise.all([
		getInventoryStock(locals.supabase),
		locals.supabase.from('product_models').select('*').order('model', { ascending: true })
	]);

	if (error) {
		console.error('Inventory load error:', error.message);
	}

	const lowStockCount = items?.filter((i) => i.low_stock).length || 0;

	return {
		items: items || [],
		models: models || [],
		lowStockCount
	};
};

export const actions: Actions = {
	uploadVariantImage: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para subir imágenes.' });
		}

		const formData = await request.formData();
		const variantId = (formData.get('variant_id') as string)?.trim() ?? '';
		const oldImageUrl = (formData.get('old_image_url') as string)?.trim() ?? '';
		const image = formData.get('image') as File | null;

		if (!variantId) {
			return fail(400, { error: 'El ID de la variante es obligatorio.' });
		}

		if (!image || image.size === 0) {
			return fail(400, { error: 'Debes seleccionar una imagen.' });
		}

		if (!image.type.startsWith('image/')) {
			return fail(400, { error: 'El archivo debe ser una imagen.' });
		}

		const bucket = 'product-variants';
		const extension = image.type === 'image/png' ? 'png' : 'jpg';
		const path = `${variantId}/${crypto.randomUUID()}.${extension}`;

		try {
			const { error: uploadError } = await locals.supabase.storage
				.from(bucket)
				.upload(path, image, {
					contentType: image.type,
					upsert: false
				});

			if (uploadError) {
				console.error('Upload error:', uploadError.message);
				return fail(400, { error: uploadError.message });
			}

			const {
				data: { publicUrl }
			} = locals.supabase.storage.from(bucket).getPublicUrl(path);

			const { error: updateError } = await locals.supabase
				.from('product_variants')
				.update({ image_url: publicUrl })
				.eq('id', variantId);

			if (updateError) {
				console.error('Update image_url error:', updateError.message);
				return fail(400, { error: updateError.message });
			}

			if (oldImageUrl) {
				try {
					const url = new URL(oldImageUrl);
					const prefix = `/storage/v1/object/public/${bucket}/`;
					if (url.pathname.startsWith(prefix)) {
						const oldPath = url.pathname.slice(prefix.length);
						await locals.supabase.storage.from(bucket).remove([oldPath]);
					}
				} catch (e) {
					console.error('Failed to remove old image:', e);
				}
			}

			return { success: true, message: 'Imagen subida.' };
		} catch (e: unknown) {
			console.error('Unexpected upload error:', e);
			const message = e instanceof Error ? e.message : 'Ocurrió un error al subir la imagen.';
			return fail(400, { error: message });
		}
	},
	deleteVariantImage: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para eliminar imágenes.' });
		}

		const formData = await request.formData();
		const variantId = (formData.get('variant_id') as string)?.trim() ?? '';
		const imageUrl = (formData.get('image_url') as string)?.trim() ?? '';

		if (!variantId) {
			return fail(400, { error: 'El ID de la variante es obligatorio.' });
		}

		const bucket = 'product-variants';

		try {
			const { error: updateError } = await locals.supabase
				.from('product_variants')
				.update({ image_url: null })
				.eq('id', variantId);

			if (updateError) {
				console.error('Delete image_url error:', updateError.message);
				return fail(400, { error: updateError.message });
			}

			if (imageUrl) {
				try {
					const url = new URL(imageUrl);
					const prefix = `/storage/v1/object/public/${bucket}/`;
					if (url.pathname.startsWith(prefix)) {
						const path = url.pathname.slice(prefix.length);
						await locals.supabase.storage.from(bucket).remove([path]);
					}
				} catch (e) {
					console.error('Failed to remove image from storage:', e);
				}
			}

			return { success: true, message: 'Imagen eliminada.' };
		} catch (e: unknown) {
			console.error('Unexpected delete image error:', e);
			const message = e instanceof Error ? e.message : 'Ocurrió un error al eliminar la imagen.';
			return fail(400, { error: message });
		}
	},
	copyVariantImage: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para copiar imágenes.' });
		}

		const formData = await request.formData();
		const sourceVariantId = (formData.get('source_variant_id') as string)?.trim() ?? '';
		const targetIdsRaw = (formData.get('target_variant_ids') as string)?.trim() ?? '';

		if (!sourceVariantId) {
			return fail(400, { error: 'El ID de la variante origen es obligatorio.' });
		}

		let targetIds: string[];
		try {
			targetIds = JSON.parse(targetIdsRaw);
			if (!Array.isArray(targetIds) || targetIds.length === 0) {
				return fail(400, { error: 'Selecciona al menos una variante destino.' });
			}
		} catch {
			return fail(400, { error: 'Formato de variantes destino inválido.' });
		}

		const bucket = 'product-variants';

		try {
			const { data: sourceVariant, error: sourceError } = await locals.supabase
				.from('product_variants')
				.select('image_url')
				.eq('id', sourceVariantId)
				.single();

			if (sourceError || !sourceVariant?.image_url) {
				return fail(400, { error: 'La variante origen no tiene imagen.' });
			}

			const sourceUrl = new URL(sourceVariant.image_url);
			const prefix = `/storage/v1/object/public/${bucket}/`;
			if (!sourceUrl.pathname.startsWith(prefix)) {
				return fail(400, { error: 'URL de imagen origen inválida.' });
			}
			const sourcePath = sourceUrl.pathname.slice(prefix.length);

			const { data: blob, error: downloadError } = await locals.supabase.storage
				.from(bucket)
				.download(sourcePath);

			if (downloadError || !blob) {
				console.error('Download error:', downloadError?.message);
				return fail(400, { error: downloadError?.message || 'No se pudo descargar la imagen origen.' });
			}

			const extension = sourcePath.split('.').pop() || 'jpg';
			const arrayBuffer = await blob.arrayBuffer();

			const { data: targets, error: targetsError } = await locals.supabase
				.from('product_variants')
				.select('id, image_url')
				.in('id', targetIds);

			if (targetsError) {
				return fail(400, { error: targetsError.message });
			}

			const oldPaths: string[] = [];
			let copied = 0;

			for (const target of targets || []) {
				const targetPath = `${target.id}/${crypto.randomUUID()}.${extension}`;
				const { error: uploadError } = await locals.supabase.storage.from(bucket).upload(
					targetPath,
					new Blob([arrayBuffer], { type: blob.type }),
					{
						contentType: blob.type,
						upsert: false
					}
				);

				if (uploadError) {
					console.error('Copy upload error:', uploadError.message);
					continue;
				}

				const {
					data: { publicUrl }
				} = locals.supabase.storage.from(bucket).getPublicUrl(targetPath);

				const { error: updateError } = await locals.supabase
					.from('product_variants')
					.update({ image_url: publicUrl })
					.eq('id', target.id);

				if (updateError) {
					console.error('Copy update error:', updateError.message);
					continue;
				}

				if (target.image_url) {
					try {
						const oldUrl = new URL(target.image_url);
						if (oldUrl.pathname.startsWith(prefix)) {
							oldPaths.push(oldUrl.pathname.slice(prefix.length));
						}
					} catch {
						// ignore invalid old url
					}
				}

				copied++;
			}

			if (oldPaths.length > 0) {
				await locals.supabase.storage.from(bucket).remove(oldPaths);
			}

			return { success: true, message: `${copied} imagen(es) copiada(s).` };
		} catch (e: unknown) {
			console.error('Unexpected copy image error:', e);
			const message = e instanceof Error ? e.message : 'Ocurrió un error al copiar la imagen.';
			return fail(400, { error: message });
		}
	}
};
