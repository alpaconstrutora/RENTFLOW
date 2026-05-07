-- Tenants Sprint 2: guarantor fields + tenant-photos bucket

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS guarantor_name     text,
  ADD COLUMN IF NOT EXISTS guarantor_document text;

-- Bucket público para fotos de inquilinos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-photos', 'tenant-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: cada usuário só mexe em arquivos na sua pasta {user_id}/
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_photos_insert_own') THEN
    CREATE POLICY "tenant_photos_insert_own" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'tenant-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_photos_update_own') THEN
    CREATE POLICY "tenant_photos_update_own" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'tenant-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='tenant_photos_delete_own') THEN
    CREATE POLICY "tenant_photos_delete_own" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'tenant-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
