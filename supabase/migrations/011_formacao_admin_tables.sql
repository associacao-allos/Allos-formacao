-- =============================================================
-- Formação Admin Tables
-- Migrado do Allos-site para o Allos formação
-- =============================================================

-- Condutores (facilitadores dos grupos)
CREATE TABLE IF NOT EXISTS certificado_condutores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Atividades (tipos de grupo/formação)
CREATE TABLE IF NOT EXISTS certificado_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  carga_horaria INTEGER DEFAULT 2,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Submissions (feedbacks/presenças dos participantes)
CREATE TABLE IF NOT EXISTS certificado_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  nome_social TEXT,
  email TEXT NOT NULL,
  atividade_nome TEXT NOT NULL,
  nota_grupo INTEGER DEFAULT 0,
  condutores TEXT[] DEFAULT '{}',
  nota_condutor INTEGER DEFAULT 0,
  relato TEXT,
  certificado_gerado BOOLEAN DEFAULT false,
  certificado_resgatado BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Horários disponíveis (ex: 14:00, 16:00, 19:00)
CREATE TABLE IF NOT EXISTS formacao_horarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hora TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Slots semanais (dia × horário)
CREATE TABLE IF NOT EXISTS formacao_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 4),
  horario_id UUID NOT NULL REFERENCES formacao_horarios(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','conduzido','nao_conduzido','cancelado','desmarcado')),
  atividade_nome TEXT,
  meet_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dia_semana, horario_id)
);

-- Alocações (condutor → slot)
CREATE TABLE IF NOT EXISTS formacao_alocacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES formacao_slots(id) ON DELETE CASCADE,
  condutor_id UUID NOT NULL REFERENCES certificado_condutores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slot_id, condutor_id)
);

-- Cronograma (config singleton: visibilidade, duração, imagem)
CREATE TABLE IF NOT EXISTS formacao_cronograma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imagem_base64 TEXT,
  grupos_visiveis BOOLEAN DEFAULT true,
  duracao_minutos INTEGER DEFAULT 90,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Eventos temporários
CREATE TABLE IF NOT EXISTS certificado_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- RLS Policies
-- =============================================================

ALTER TABLE certificado_condutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_eventos ENABLE ROW LEVEL SECURITY;

-- SELECT: aberto para todos (form público precisa ler)
CREATE POLICY "select_condutores" ON certificado_condutores FOR SELECT USING (true);
CREATE POLICY "select_atividades" ON certificado_atividades FOR SELECT USING (true);
CREATE POLICY "select_submissions" ON certificado_submissions FOR SELECT USING (true);
CREATE POLICY "select_horarios" ON formacao_horarios FOR SELECT USING (true);
CREATE POLICY "select_slots" ON formacao_slots FOR SELECT USING (true);
CREATE POLICY "select_alocacoes" ON formacao_alocacoes FOR SELECT USING (true);
CREATE POLICY "select_cronograma" ON formacao_cronograma FOR SELECT USING (true);
CREATE POLICY "select_eventos" ON certificado_eventos FOR SELECT USING (true);

-- INSERT em submissions: aberto para anon (form público)
CREATE POLICY "insert_submissions_anon" ON certificado_submissions FOR INSERT WITH CHECK (true);

-- UPDATE em submissions: aberto (para certificado_resgatado)
CREATE POLICY "update_submissions" ON certificado_submissions FOR UPDATE USING (true);

-- Admin full access (INSERT/UPDATE/DELETE) via service role bypasses RLS
-- Para admin pages que usam createClient() com anon key, criamos policies baseadas no role do profile
CREATE POLICY "admin_all_condutores" ON certificado_condutores FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_atividades" ON certificado_atividades FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_delete_submissions" ON certificado_submissions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_horarios" ON formacao_horarios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_slots" ON formacao_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_alocacoes" ON formacao_alocacoes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_cronograma" ON formacao_cronograma FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_eventos" ON certificado_eventos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_submissions_nome ON certificado_submissions(nome_completo);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON certificado_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_slots_horario ON formacao_slots(horario_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_slot ON formacao_alocacoes(slot_id);

-- Horários padrão
INSERT INTO formacao_horarios (hora, ordem) VALUES ('14:00', 1), ('16:00', 2), ('19:00', 3)
ON CONFLICT DO NOTHING;
