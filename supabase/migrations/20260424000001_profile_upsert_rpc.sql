CREATE OR REPLACE FUNCTION upsert_profile(
  p_name    text,
  p_document text,
  p_phone   text,
  p_address text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, document, phone, address)
  VALUES (auth.uid(), p_name, p_document, p_phone, p_address)
  ON CONFLICT (id) DO UPDATE SET
    name     = EXCLUDED.name,
    document = EXCLUDED.document,
    phone    = EXCLUDED.phone,
    address  = EXCLUDED.address;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_profile(text, text, text, text) TO authenticated;
