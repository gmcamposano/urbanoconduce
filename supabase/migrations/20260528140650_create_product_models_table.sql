CREATE TABLE public.product_models (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  model text NOT NULL UNIQUE CHECK (btrim(model) <> ''::text),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read product models"
  ON public.product_models FOR SELECT
  USING (true);

CREATE POLICY "Editors and admins can insert product models"
  ON public.product_models FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = created_by
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can update product models"
  ON public.product_models FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = created_by
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can delete product models"
  ON public.product_models FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = created_by
      AND role IN ('admin', 'editor')
    )
  );