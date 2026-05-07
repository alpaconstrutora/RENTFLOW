-- ================================================
-- P1.3: Snapshots PDF de contratos
-- Tabela: lease_documents — histórico de versões
-- Bucket: lease-documents (privado)
-- ================================================

CREATE TABLE lease_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lease_id     uuid REFERENCES leases ON DELETE CASCADE NOT NULL,
  version      int NOT NULL DEFAULT 1,
  storage_path text NOT NULL,
  label        text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE lease_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_lease_documents" ON lease_documents
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Bucket privado (signed URLs para download)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lease-documents', 'lease-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS no Storage: usuário só acessa sua própria pasta {user_id}/
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'lease_docs_select'
  ) THEN
    CREATE POLICY "lease_docs_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'lease-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'lease_docs_insert'
  ) THEN
    CREATE POLICY "lease_docs_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'lease-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
