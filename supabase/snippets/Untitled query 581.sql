-- ═══════════════════════════════════════════════════════════════
-- Property Photos: coluna + bucket de storage + RLS
-- ═══════════════════════════════════════════════════════════════

-- 1. Coluna para URL da foto
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Bucket público (acesso de leitura anônimo, upload/delete restritos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS — cada usuário só mexe em arquivos na sua pasta {user_id}/
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_insert_own') THEN
    CREATE POLICY "property_photos_insert_own" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'property-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_update_own') THEN
    CREATE POLICY "property_photos_update_own" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'property-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_delete_own') THEN
    CREATE POLICY "property_photos_delete_own" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'property-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
