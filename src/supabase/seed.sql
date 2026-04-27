-- Cidade
INSERT INTO
    public.cidades (id, nome, estado, ativo)
VALUES
    (
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Ibirama',
        'SC',
        true
    ) ON CONFLICT (nome, estado) DO NOTHING;

-- Bairros
INSERT INTO
    public.bairros (id, id_cidade, nome)
VALUES
    (
        '82b4fc85-5f54-4a3b-9a67-7182f15c9b0a',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Centro'
    ),
    (
        '9067f8a1-3d2e-48b4-8ac9-4d1375f0e921',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Ribeirão Areado'
    ),
    (
        'b1c8d4e2-7a5f-4f3c-9f0d-2b8e6c1a4d23',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Progresso'
    ),
    (
        'c239d7b6-21f8-4b9e-8a3d-0c7f2e4a5b69',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Ponto Chic'
    ),
    (
        'd740f3a8-6b1e-4f2d-9c8a-5e7f1b3c9a24',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'Bela Vista'
    ) ON CONFLICT (id_cidade, nome) DO NOTHING;

-- Estabelecimentos
INSERT INTO
    public.estabelecimentos (
        id,
        id_cidade,
        id_bairro,
        nome,
        logradouro,
        tipo,
        ativo
    )
VALUES
    (
        'f1a2b3c4-d5e6-7f81-9a0b-1c2d3e4f5a6b',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        '82b4fc85-5f54-4a3b-9a67-7182f15c9b0a',
        'Cooper',
        'R. Mirador, 104',
        'supermercado',
        true
    ),
    (
        'a2b3c4d5-e6f7-8190-a1b2-3c4d5e6f7a8b',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        '82b4fc85-5f54-4a3b-9a67-7182f15c9b0a',
        'Rede Top',
        'R. Marquês do Herval, 136',
        'supermercado',
        true
    ),
    (
        'b3c4d5e6-f7a8-9012-b3c4-d5e6f7a8b9c0',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        '82b4fc85-5f54-4a3b-9a67-7182f15c9b0a',
        'Solar Master Vale',
        'R. Duque de Caxias, 03',
        'supermercado',
        true
    ),
    (
        'c4d5e6f7-a8b9-0123-c4d5-e6f7a8b9c0d1',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        '82b4fc85-5f54-4a3b-9a67-7182f15c9b0a',
        'Queijeiro Mercearia',
        'R. Marquês do Herval, 2231',
        'supermercado',
        true
    ),
    (
        'd5e6f7a8-b9c0-1234-d5e6-f7a8b9c0d1e2',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        '9067f8a1-3d2e-48b4-8ac9-4d1375f0e921',
        'Mercado Areado',
        'Avenida Castelo Branco',
        'supermercado',
        true
    ),
    (
        'e6f7a8b9-c0d1-2345-e6f7-a8b9c0d1e2f3',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'b1c8d4e2-7a5f-4f3c-9f0d-2b8e6c1a4d23',
        'Mercado Oliveira',
        'R. Santa Cruz',
        'supermercado',
        true
    ),
    (
        'f7a8b9c0-d1e2-3456-f7a8-b9c0d1e2f3a4',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'c239d7b6-21f8-4b9e-8a3d-0c7f2e4a5b69',
        'Wagner Bebidas',
        'R. José Wagner, 36',
        'supermercado',
        true
    ),
    (
        'a8b9c0d1-e2f3-4567-a8b9-c0d1e2f3a4b5',
        '3f9d5f77-8e7d-4d2f-9cfe-1a2b3c4d5e6f',
        'd740f3a8-6b1e-4f2d-9c8a-5e7f1b3c9a24',
        'Rede Morreti',
        'R. Dr. Getúlio Vargas',
        'supermercado',
        true
    );