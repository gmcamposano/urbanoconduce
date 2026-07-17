export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.5';
	};
	public: {
		Tables: {
			accounting: {
				Row: {
					amount: number;
					client_id: string;
					created_at: string;
					created_by: string | null;
					id: string;
					invoice_id: string | null;
					notes: string | null;
					payment_date: string;
					payment_method: string;
					reference_number: string | null;
				};
				Insert: {
					amount: number;
					client_id: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					invoice_id?: string | null;
					notes?: string | null;
					payment_date?: string;
					payment_method: string;
					reference_number?: string | null;
				};
				Update: {
					amount?: number;
					client_id?: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					invoice_id?: string | null;
					notes?: string | null;
					payment_date?: string;
					payment_method?: string;
					reference_number?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'accounting_client_id_fkey';
						columns: ['client_id'];
						isOneToOne: false;
						referencedRelation: 'clients';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'accounting_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'accounting_invoice_id_fkey';
						columns: ['invoice_id'];
						isOneToOne: false;
						referencedRelation: 'invoices';
						referencedColumns: ['id'];
					}
				];
			};
			accounting_allocations: {
				Row: {
					applied_amount: number;
					created_at: string;
					id: string;
					invoice_id: string;
					payment_id: string;
				};
				Insert: {
					applied_amount: number;
					created_at?: string;
					id?: string;
					invoice_id: string;
					payment_id: string;
				};
				Update: {
					applied_amount?: number;
					created_at?: string;
					id?: string;
					invoice_id?: string;
					payment_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'accounting_allocations_invoice_id_fkey';
						columns: ['invoice_id'];
						isOneToOne: false;
						referencedRelation: 'invoices';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'accounting_allocations_payment_id_fkey';
						columns: ['payment_id'];
						isOneToOne: false;
						referencedRelation: 'accounting';
						referencedColumns: ['id'];
					}
				];
			};
			allowed_emails: {
				Row: {
					created_at: string;
					created_by: string | null;
					description: string | null;
					id: string;
					is_active: boolean;
					pattern: string;
					pattern_type: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					created_by?: string | null;
					description?: string | null;
					id?: string;
					is_active?: boolean;
					pattern: string;
					pattern_type?: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					description?: string | null;
					id?: string;
					is_active?: boolean;
					pattern?: string;
					pattern_type?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'allowed_emails_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			client_product_prices: {
				Row: {
					client_id: string;
					created_at: string;
					created_by: string | null;
					id: string;
					product_id: string;
					unit_price: number;
					updated_at: string;
				};
				Insert: {
					client_id: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					product_id: string;
					unit_price: number;
					updated_at?: string;
				};
				Update: {
					client_id?: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					product_id?: string;
					unit_price?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'client_product_prices_client_id_fkey';
						columns: ['client_id'];
						isOneToOne: false;
						referencedRelation: 'clients';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'client_product_prices_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'client_product_prices_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			clients: {
				Row: {
					alias: string | null;
					client_type: string;
					company_name: string | null;
					created_at: string;
					created_by: string | null;
					email: string | null;
					full_name: string | null;
					id: string;
					phone: string | null;
					rnc: string | null;
					updated_at: string;
				};
				Insert: {
					alias?: string | null;
					client_type: string;
					company_name?: string | null;
					created_at?: string;
					created_by?: string | null;
					email?: string | null;
					full_name?: string | null;
					id?: string;
					phone?: string | null;
					rnc?: string | null;
					updated_at?: string;
				};
				Update: {
					alias?: string | null;
					client_type?: string;
					company_name?: string | null;
					created_at?: string;
					created_by?: string | null;
					email?: string | null;
					full_name?: string | null;
					id?: string;
					phone?: string | null;
					rnc?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'clients_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			inventory_movements: {
				Row: {
					created_at: string;
					created_by: string | null;
					id: string;
					notes: string | null;
					product_variant_id: string;
					quantity: number;
					reference_id: string | null;
					reference_type: string | null;
					type: string;
					warehouse_id: string;
				};
				Insert: {
					created_at?: string;
					created_by?: string | null;
					id?: string;
					notes?: string | null;
					product_variant_id: string;
					quantity: number;
					reference_id?: string | null;
					reference_type?: string | null;
					type: string;
					warehouse_id: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					id?: string;
					notes?: string | null;
					product_variant_id?: string;
					quantity?: number;
					reference_id?: string | null;
					reference_type?: string | null;
					type?: string;
					warehouse_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'inventory_movements_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'inventory_movements_product_variant_id_fkey';
						columns: ['product_variant_id'];
						isOneToOne: false;
						referencedRelation: 'product_variants';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'inventory_movements_warehouse_id_fkey';
						columns: ['warehouse_id'];
						isOneToOne: false;
						referencedRelation: 'warehouses';
						referencedColumns: ['id'];
					}
				];
			};
			invoice_items: {
				Row: {
					amount: number;
					color: string | null;
					created_at: string;
					description: string;
					id: string;
					invoice_id: string;
					model: string | null;
					product_id: string | null;
					product_variant_id: string | null;
					quantity: number;
					unit_price: number;
				};
				Insert: {
					amount: number;
					color?: string | null;
					created_at?: string;
					description: string;
					id?: string;
					invoice_id: string;
					model?: string | null;
					product_id?: string | null;
					product_variant_id?: string | null;
					quantity: number;
					unit_price: number;
				};
				Update: {
					amount?: number;
					color?: string | null;
					created_at?: string;
					description?: string;
					id?: string;
					invoice_id?: string;
					model?: string | null;
					product_id?: string | null;
					product_variant_id?: string | null;
					quantity?: number;
					unit_price?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'invoice_items_invoice_id_fkey';
						columns: ['invoice_id'];
						isOneToOne: false;
						referencedRelation: 'invoices';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'invoice_items_model_fkey';
						columns: ['model'];
						isOneToOne: false;
						referencedRelation: 'product_models';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'invoice_items_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'invoice_items_product_variant_id_fkey';
						columns: ['product_variant_id'];
						isOneToOne: false;
						referencedRelation: 'product_variants';
						referencedColumns: ['id'];
					}
				];
			};
			invoices: {
				Row: {
					client_email: string;
					client_id: string | null;
					client_name: string;
					created_at: string;
					created_by: string | null;
					discount_amount: number;
					document_type: string;
					due_date: string;
					factura_tipo: string;
					id: string;
					invoice_date: string;
					invoice_number: string;
					ncf: string | null;
					notes: string | null;
					status: string;
					tax_rate: number;
					total_amount: number;
				};
				Insert: {
					client_email: string;
					client_id?: string | null;
					client_name: string;
					created_at?: string;
					created_by?: string | null;
					discount_amount?: number;
					document_type?: string;
					due_date: string;
					factura_tipo?: string;
					id?: string;
					invoice_date?: string;
					invoice_number: string;
					ncf?: string | null;
					notes?: string | null;
					status?: string;
					tax_rate?: number;
					total_amount?: number;
				};
				Update: {
					client_email?: string;
					client_id?: string | null;
					client_name?: string;
					created_at?: string;
					created_by?: string | null;
					discount_amount?: number;
					document_type?: string;
					due_date?: string;
					factura_tipo?: string;
					id?: string;
					invoice_date?: string;
					invoice_number?: string;
					ncf?: string | null;
					notes?: string | null;
					status?: string;
					tax_rate?: number;
					total_amount?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'invoices_client_id_fkey';
						columns: ['client_id'];
						isOneToOne: false;
						referencedRelation: 'clients';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'invoices_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			product_colors: {
				Row: {
					color: string;
					created_at: string;
					created_by: string | null;
					id: string;
					updated_at: string;
				};
				Insert: {
					color: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					updated_at?: string;
				};
				Update: {
					color?: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_colors_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			product_models: {
				Row: {
					created_at: string | null;
					created_by: string | null;
					id: string;
					model: string;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					created_by?: string | null;
					id?: string;
					model: string;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					created_by?: string | null;
					id?: string;
					model?: string;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'product_models_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			product_variants: {
				Row: {
					color: string;
					created_at: string;
					created_by: string | null;
					id: string;
					min_stock: number;
					product_id: string;
					purchase_price: number | null;
					sku: string | null;
					updated_at: string;
				};
				Insert: {
					color?: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					min_stock?: number;
					product_id: string;
					purchase_price?: number | null;
					sku?: string | null;
					updated_at?: string;
				};
				Update: {
					color?: string;
					created_at?: string;
					created_by?: string | null;
					id?: string;
					min_stock?: number;
					product_id?: string;
					purchase_price?: number | null;
					sku?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_variants_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'product_variants_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			products: {
				Row: {
					client_id: string | null;
					created_at: string;
					created_by: string | null;
					description: string | null;
					id: string;
					model: string | null;
					price_without_taxes: number;
					title: string;
					updated_at: string;
				};
				Insert: {
					client_id?: string | null;
					created_at?: string;
					created_by?: string | null;
					description?: string | null;
					id?: string;
					model?: string | null;
					price_without_taxes: number;
					title: string;
					updated_at?: string;
				};
				Update: {
					client_id?: string | null;
					created_at?: string;
					created_by?: string | null;
					description?: string | null;
					id?: string;
					model?: string | null;
					price_without_taxes?: number;
					title?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'products_client_id_fkey';
						columns: ['client_id'];
						isOneToOne: false;
						referencedRelation: 'clients';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'products_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'products_model_fkey';
						columns: ['model'];
						isOneToOne: false;
						referencedRelation: 'product_models';
						referencedColumns: ['id'];
					}
				];
			};
			profiles: {
				Row: {
					email: string;
					id: string;
					name: string | null;
					role: string;
					updated_at: string;
				};
				Insert: {
					email: string;
					id: string;
					name?: string | null;
					role?: string;
					updated_at?: string;
				};
				Update: {
					email?: string;
					id?: string;
					name?: string | null;
					role?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			warehouses: {
				Row: {
					created_at: string;
					created_by: string | null;
					id: string;
					is_default: boolean;
					name: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					created_by?: string | null;
					id?: string;
					is_default?: boolean;
					name: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					id?: string;
					is_default?: boolean;
					name?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'warehouses_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			delete_accounting_payment: {
				Args: { p_payment_id: string };
				Returns: Json;
			};
			is_email_allowed: { Args: { email: string }; Returns: boolean };
			recalculate_invoice_status: {
				Args: { p_invoice_id: string };
				Returns: undefined;
			};
			record_accounting_payment: {
				Args: {
					p_amount: number;
					p_client_id: string;
					p_created_by?: string;
					p_notes?: string;
					p_payment_date: string;
					p_payment_method: string;
					p_reference_number?: string;
				};
				Returns: Json;
			};
			update_accounting_payment: {
				Args: {
					p_amount: number;
					p_client_id: string;
					p_notes?: string;
					p_payment_date: string;
					p_payment_id: string;
					p_payment_method: string;
					p_reference_number?: string;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {}
	}
} as const;
