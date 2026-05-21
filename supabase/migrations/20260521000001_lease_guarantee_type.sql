ALTER TABLE leases
  ADD COLUMN guarantee_type text
    CHECK (guarantee_type IN ('fiador','caucao','seguro_fianca','titulo_capitalizacao','nenhuma'))
    DEFAULT 'nenhuma';
