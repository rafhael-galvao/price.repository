


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."tipo_estabelecimento" AS ENUM (
    'supermercado',
    'farmacia',
    'posto_combustivel'
);


ALTER TYPE "public"."tipo_estabelecimento" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_ofertas"("p_termo" "text", "p_id_cidade" "uuid" DEFAULT NULL::"uuid", "p_limite" integer DEFAULT 5) RETURNS TABLE("produto" "text", "preco" numeric, "estabelecimento" "text", "tipo_estabelecimento" "text", "bairro" "text", "logradouro" "text", "cidade" "text", "observacao" "text", "validade_fim" "date", "categoria" "text")
    LANGUAGE "sql"
    AS $$
  select
    p.nome as produto,
    o.preco,
    e.nome as estabelecimento,
    e.tipo::text as tipo_estabelecimento,
    b.nome as bairro,
    e.logradouro,
    cid.nome as cidade,
    o.observacao,
    o.validade_fim,
    cat.nome as categoria
  from public.ofertas o
  join public.estabelecimentos e on e.id = o.id_estabelecimento
  join public.cidades cid on cid.id = e.id_cidade
  join public.produtos p on p.id = o.id_produto
  left join public.bairros b on b.id = e.id_bairro
  left join public.categorias cat on cat.id = p.id_categoria
  where
    e.ativo = true
    and cid.ativo = true
    and (o.validade_fim is null or o.validade_fim >= current_date)
    and (p_id_cidade is null or e.id_cidade = p_id_cidade)
    and (
      public.similarity(p.nome_search, lower(public.unaccent(p_termo))) > 0.3
      or exists (
        select 1
        from public.sinonimos si
        where si.id_produto = p.id
          and public.similarity(si.termo_search, lower(public.unaccent(p_termo))) > 0.3
      )
    )
  order by
    public.similarity(p.nome_search, lower(public.unaccent(p_termo))) desc,
    o.preco asc
  limit p_limite;
$$;


ALTER FUNCTION "public"."buscar_ofertas"("p_termo" "text", "p_id_cidade" "uuid", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_set_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."produtos_set_nome_search"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.nome_search := lower(public.unaccent(coalesce(new.nome, '')));
  return new;
end;
$$;


ALTER FUNCTION "public"."produtos_set_nome_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_log_intencao"("p_classificacao" "text", "p_id_mensagem_whatsapp" "text", "p_mensagem_normalizada" "text", "p_mensagem_recebida" "text", "p_telefone_usuario" "text", "p_termo_identificado" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_id_usuario uuid;
  v_id uuid;
BEGIN
  -- valida classificação (espelha o CHECK da tabela)
  IF p_classificacao NOT IN ('busca','saudacao','desconhecido') THEN
    RAISE EXCEPTION 'classificacao inválida: %', p_classificacao;
  END IF;

  -- Não existe FK com auth.users no seu schema; id_usuario é opcional.
  -- Mantemos null por padrão.
  v_id_usuario := NULL;

  INSERT INTO public.log_intencoes (
    id_usuario,
    classificacao,
    termo_identificado,
    mensagem_recebida,
    mensagem_normalizada,
    id_mensagem_whatsapp
  ) VALUES (
    v_id_usuario,
    p_classificacao,
    p_termo_identificado,
    p_mensagem_recebida,
    p_mensagem_normalizada,
    p_id_mensagem_whatsapp
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."registrar_log_intencao"("p_classificacao" "text", "p_id_mensagem_whatsapp" "text", "p_mensagem_normalizada" "text", "p_mensagem_recebida" "text", "p_telefone_usuario" "text", "p_termo_identificado" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_log_resposta"("p_id_intencao" "uuid", "p_total_resultados_busca" integer DEFAULT 0, "p_resultados" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.log_respostas (
    id_intencao,
    total_resultados_busca,
    resultados
  ) VALUES (
    p_id_intencao,
    COALESCE(p_total_resultados_busca, 0),
    COALESCE(p_resultados, '[]'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."registrar_log_resposta"("p_id_intencao" "uuid", "p_total_resultados_busca" integer, "p_resultados" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sinonimos_set_termo_search"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.termo_search := lower(public.unaccent(coalesce(new.termo, '')));
  return new;
end;
$$;


ALTER FUNCTION "public"."sinonimos_set_termo_search"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bairros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_cidade" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bairros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "ordem" integer DEFAULT 0
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "estado" character(2) DEFAULT 'SC'::"bpchar" NOT NULL,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estabelecimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_cidade" "uuid" NOT NULL,
    "id_bairro" "uuid",
    "nome" "text" NOT NULL,
    "logradouro" "text",
    "tipo" "public"."tipo_estabelecimento" DEFAULT 'supermercado'::"public"."tipo_estabelecimento" NOT NULL,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."estabelecimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_intencoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_usuario" "uuid",
    "classificacao" "text" NOT NULL,
    "termo_identificado" "text",
    "mensagem_recebida" "text" NOT NULL,
    "mensagem_normalizada" "text",
    "recebido_em" timestamp with time zone DEFAULT "now"(),
    "id_mensagem_whatsapp" "text" NOT NULL,
    CONSTRAINT "log_intencoes_classificacao_check" CHECK (("classificacao" = ANY (ARRAY['busca'::"text", 'saudacao'::"text", 'desconhecido'::"text"])))
);


ALTER TABLE "public"."log_intencoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_respostas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_intencao" "uuid" NOT NULL,
    "total_resultados_busca" integer,
    "resultados" "jsonb",
    "respondido_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."log_respostas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ofertas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_estabelecimento" "uuid" NOT NULL,
    "id_produto" "uuid" NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "observacao" "text",
    "validade_fim" "date",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ofertas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_categoria" "uuid",
    "nome" "text" NOT NULL,
    "unidade" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "nome_search" "text",
    CONSTRAINT "produtos_unidade_check" CHECK (("unidade" = ANY (ARRAY['kg'::"text", 'g'::"text", 'L'::"text", 'ml'::"text", 'un'::"text", 'cx'::"text", 'pct'::"text", 'dz'::"text"])))
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sinonimos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_produto" "uuid" NOT NULL,
    "termo" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "termo_search" "text"
);


ALTER TABLE "public"."sinonimos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telefone" "text" NOT NULL,
    "primeiro_acesso_em" timestamp with time zone DEFAULT "now"(),
    "ultimo_acesso_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_id_cidade_nome_key" UNIQUE ("id_cidade", "nome");



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cidades"
    ADD CONSTRAINT "cidades_nome_estado_key" UNIQUE ("nome", "estado");



ALTER TABLE ONLY "public"."cidades"
    ADD CONSTRAINT "cidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estabelecimentos"
    ADD CONSTRAINT "estabelecimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_intencoes"
    ADD CONSTRAINT "log_intencoes_id_mensagem_whatsapp_key" UNIQUE ("id_mensagem_whatsapp");



ALTER TABLE ONLY "public"."log_intencoes"
    ADD CONSTRAINT "log_intencoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_respostas"
    ADD CONSTRAINT "log_respostas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_id_estabelecimento_id_produto_key" UNIQUE ("id_estabelecimento", "id_produto");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sinonimos"
    ADD CONSTRAINT "sinonimos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sinonimos"
    ADD CONSTRAINT "sinonimos_termo_key" UNIQUE ("termo");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_telefone_key" UNIQUE ("telefone");



CREATE INDEX "bairros_cidade_idx" ON "public"."bairros" USING "btree" ("id_cidade");



CREATE INDEX "estabelecimentos_bairro_idx" ON "public"."estabelecimentos" USING "btree" ("id_bairro");



CREATE INDEX "estabelecimentos_cidade_idx" ON "public"."estabelecimentos" USING "btree" ("id_cidade");



CREATE INDEX "ofertas_produto_idx" ON "public"."ofertas" USING "btree" ("id_produto", "preco");



CREATE INDEX "ofertas_validade_idx" ON "public"."ofertas" USING "btree" ("validade_fim") WHERE ("validade_fim" IS NOT NULL);



CREATE INDEX "produtos_nome_trgm_idx" ON "public"."produtos" USING "gin" ("nome_search" "public"."gin_trgm_ops");



CREATE INDEX "sinonimos_termo_trgm_idx" ON "public"."sinonimos" USING "gin" ("termo_search" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "trg_ofertas_atualizado_em" BEFORE UPDATE ON "public"."ofertas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_atualizado_em"();



CREATE OR REPLACE TRIGGER "trg_produtos_nome_search" BEFORE INSERT OR UPDATE ON "public"."produtos" FOR EACH ROW EXECUTE FUNCTION "public"."produtos_set_nome_search"();



CREATE OR REPLACE TRIGGER "trg_sinonimos_termo_search" BEFORE INSERT OR UPDATE ON "public"."sinonimos" FOR EACH ROW EXECUTE FUNCTION "public"."sinonimos_set_termo_search"();



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_id_cidade_fkey" FOREIGN KEY ("id_cidade") REFERENCES "public"."cidades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estabelecimentos"
    ADD CONSTRAINT "estabelecimentos_id_bairro_fkey" FOREIGN KEY ("id_bairro") REFERENCES "public"."bairros"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estabelecimentos"
    ADD CONSTRAINT "estabelecimentos_id_cidade_fkey" FOREIGN KEY ("id_cidade") REFERENCES "public"."cidades"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."log_intencoes"
    ADD CONSTRAINT "log_intencoes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."log_respostas"
    ADD CONSTRAINT "log_respostas_id_intencao_fkey" FOREIGN KEY ("id_intencao") REFERENCES "public"."log_intencoes"("id");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_id_estabelecimento_fkey" FOREIGN KEY ("id_estabelecimento") REFERENCES "public"."estabelecimentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_id_produto_fkey" FOREIGN KEY ("id_produto") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sinonimos"
    ADD CONSTRAINT "sinonimos_id_produto_fkey" FOREIGN KEY ("id_produto") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE "public"."bairros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estabelecimentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_intencoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_respostas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ofertas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sinonimos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."buscar_ofertas"("p_termo" "text", "p_id_cidade" "uuid", "p_limite" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_ofertas"("p_termo" "text", "p_id_cidade" "uuid", "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_ofertas"("p_termo" "text", "p_id_cidade" "uuid", "p_limite" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."produtos_set_nome_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."produtos_set_nome_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."produtos_set_nome_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_log_intencao"("p_classificacao" "text", "p_id_mensagem_whatsapp" "text", "p_mensagem_normalizada" "text", "p_mensagem_recebida" "text", "p_telefone_usuario" "text", "p_termo_identificado" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_log_intencao"("p_classificacao" "text", "p_id_mensagem_whatsapp" "text", "p_mensagem_normalizada" "text", "p_mensagem_recebida" "text", "p_telefone_usuario" "text", "p_termo_identificado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_log_intencao"("p_classificacao" "text", "p_id_mensagem_whatsapp" "text", "p_mensagem_normalizada" "text", "p_mensagem_recebida" "text", "p_telefone_usuario" "text", "p_termo_identificado" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_log_resposta"("p_id_intencao" "uuid", "p_total_resultados_busca" integer, "p_resultados" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_log_resposta"("p_id_intencao" "uuid", "p_total_resultados_busca" integer, "p_resultados" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_log_resposta"("p_id_intencao" "uuid", "p_total_resultados_busca" integer, "p_resultados" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sinonimos_set_termo_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."sinonimos_set_termo_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sinonimos_set_termo_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."bairros" TO "anon";
GRANT ALL ON TABLE "public"."bairros" TO "authenticated";
GRANT ALL ON TABLE "public"."bairros" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."cidades" TO "anon";
GRANT ALL ON TABLE "public"."cidades" TO "authenticated";
GRANT ALL ON TABLE "public"."cidades" TO "service_role";



GRANT ALL ON TABLE "public"."estabelecimentos" TO "anon";
GRANT ALL ON TABLE "public"."estabelecimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."estabelecimentos" TO "service_role";



GRANT ALL ON TABLE "public"."log_intencoes" TO "anon";
GRANT ALL ON TABLE "public"."log_intencoes" TO "authenticated";
GRANT ALL ON TABLE "public"."log_intencoes" TO "service_role";



GRANT ALL ON TABLE "public"."log_respostas" TO "anon";
GRANT ALL ON TABLE "public"."log_respostas" TO "authenticated";
GRANT ALL ON TABLE "public"."log_respostas" TO "service_role";



GRANT ALL ON TABLE "public"."ofertas" TO "anon";
GRANT ALL ON TABLE "public"."ofertas" TO "authenticated";
GRANT ALL ON TABLE "public"."ofertas" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."sinonimos" TO "anon";
GRANT ALL ON TABLE "public"."sinonimos" TO "authenticated";
GRANT ALL ON TABLE "public"."sinonimos" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

