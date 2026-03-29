// Script to seed courses from YouTube playlists into Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cjmfjwgkrcskwijgujlv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const INSTRUCTOR_ID = process.env.INSTRUCTOR_ID || "50edd22c-a797-4ca0-af37-7377299c6db0";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function supaInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to insert into ${table}: ${err}`);
  }
  return res.json();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ytThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

const courses = [
  {
    title: "Como Estudar?",
    slug: "como-estudar",
    description: "Técnicas de estudo, memória e articulações clínicas para estudantes de psicologia.",
    category: "Epistemologia",
    thumbnail_video: "N7W29rb0WAs",
    lessons: [
      { title: "Por que Esquecemos a Resposta JUSTAMENTE na Hora da Prova?", id: "N7W29rb0WAs", duration: 641 },
      { title: "Palácio Mental - Sua memória é MUITO MELHOR do que você pensa!", id: "-OttfMFSq8g", duration: 1127 },
      { title: "Teoria e Prática - Memória e Articulações Clínicas", id: "l_Nshms9y6Y", duration: 1486 },
      { title: "Prontuário NÃO É construção de caso!", id: "mStuMUcUcSs", duration: 811 },
      { title: "Curva de Esquecimento", id: "SgXVgTIDD6E", duration: 163 },
      { title: "Por que os livros que você lê não trazem sucesso?", id: "5gIOphH8qdA", duration: 1927 },
    ],
  },
  {
    title: "Dicas para a Avaliação Clínica",
    slug: "dicas-avaliacao-clinica",
    description: "Orientações práticas para avaliação clínica, escuta terapêutica e manejo de sessões.",
    category: "Prática Clínica",
    thumbnail_video: "NJBRCNbPc3Q",
    lessons: [
      { title: "Meu paciente está PRONTO? - Estágios de Mudança", id: "NJBRCNbPc3Q", duration: 1141 },
      { title: "Como fazer Intervenções Clínicas mais POTENTES?", id: "u1uOyDlyjUU", duration: 1236 },
      { title: "Comecei na clínica, E AGORA?", id: "JTso5qJYMNU", duration: 1083 },
      { title: "Máximas para a PERFORMANCE CLÍNICA", id: "TkaAFt7menY", duration: 1201 },
      { title: "Como treinar sua escuta clínica? Esquema de aprofundamento", id: "pbCStH1GWgY", duration: 737 },
      { title: "Dicas para quem tem medo de começar a atender", id: "RPVjdqdzcMY", duration: 1100 },
      { title: "Abertura e Encerramento de Sessão Clínica", id: "t1vRYiBKZFY", duration: 1592 },
      { title: "Construção de Frases na Psicanálise", id: "EQ15ZGuigog", duration: 969 },
      { title: "Entrevistas Preliminares: Como Conduzir uma Primeira Sessão", id: "UygS_g0ipl0", duration: 1193 },
      { title: "Primeira Sessão em TCC: O que devo evitar?", id: "zG7e2OoxWXU", duration: 2110 },
      { title: "Como entrar na Allos", id: "HlYGLPwRMFc", duration: 2170 },
      { title: "Como funciona o Instrumento de Avaliação", id: "jYbUiWwmF2I", duration: 2154 },
      { title: "Como estruturar uma devolutiva clínica", id: "08PygIYaAP4", duration: 1637 },
      { title: "Bacon causa câncer? O padrão-ouro da Psicologia", id: "3rJ2OGfqYkQ", duration: 1664 },
    ],
  },
  {
    title: "Psicologia Geral",
    slug: "psicologia-geral",
    description: "Fundamentos de hermenêutica, prática baseada em evidências e manejo clínico concreto.",
    category: "Epistemologia",
    thumbnail_video: "WzFJFIem8EE",
    lessons: [
      { title: "Máximas Psicológicas: Como trabalhar de forma concreta na clínica?", id: "WzFJFIem8EE", duration: 7443 },
      { title: "Introdução à Hermenêutica aplicada à Psicoterapia | Aula 01", id: "lhOlhOd3bDY", duration: 9344 },
      { title: "Os Pilares do Laço Social: Introdução aos Quatro Discursos de Lacan", id: "xAONKn8u6YI", duration: 3425 },
      { title: "O que é uma Prática Baseada em Evidências?", id: "iCcCK4y67zc", duration: 5214 },
      { title: "Guia Prático Para Conduzir Grupos Terapêuticos", id: "akntkQtpBuo", duration: 3495 },
      { title: "Hermenêutica na prática! Como interpretar o discurso dos pacientes | Aula 02", id: "zOGFBaKfWT0", duration: 2965 },
      { title: "Quem Define a Cura? Desvendando os Objetivos da Terapia", id: "AVV2-63V3RY", duration: 3228 },
    ],
  },
  {
    title: "Avaliação Psicológica",
    slug: "avaliacao-psicologica",
    description: "Módulo introdutório sobre neuropsicologia, psicodiagnóstico, testes projetivos e psicométricos.",
    category: "Avaliação",
    thumbnail_video: "Qb3VDFROekY",
    lessons: [
      { title: "Aula 1 - Neuropsicologia e Psicodiagnóstico", id: "Qb3VDFROekY", duration: 761 },
      { title: "Aula 2 - Testes Psicométricos", id: "bkl5DcgIzro", duration: 989 },
      { title: "Aula 3 - Testes Projetivos", id: "OLxGf1yAsFk", duration: 1082 },
      { title: "Aula 4 - Ética, SATEPSI, IBAP e uso exclusivo dos psicólogos", id: "5UNexayMzUo", duration: 1611 },
      { title: "Aula 5 - Caminhos da profissão e panorama dos testes", id: "IyvnPlpi_8I", duration: 1628 },
    ],
  },
  {
    title: "Psicologia Comparada",
    slug: "psicologia-comparada",
    description: "Fundamentos filosóficos da psicologia, direção do tratamento e prioridades na clínica.",
    category: "Epistemologia",
    thumbnail_video: "O14oA2t0QnY",
    lessons: [
      { title: "Quem aponta a direção do tratamento?", id: "O14oA2t0QnY", duration: 1347 },
      { title: "O que devo PRIORIZAR na clínica?", id: "F5E4nqeb2uI", duration: 2746 },
      { title: "POR ONDE COMEÇAR? Os fundamentos filosóficos da PSICOLOGIA", id: "KZvvyhSI0bs", duration: 899 },
      { title: "Métodos em Psicologia Comparada: FILOLOGIA", id: "W8Vdpq2D7sc", duration: 2419 },
    ],
  },
  {
    title: "Psicologia Baseada em Evidências (PBE)",
    slug: "psicologia-baseada-em-evidencias",
    description: "Introdução à prática baseada em evidências: expertise clínica, evidência disponível e preferências do paciente.",
    category: "Epistemologia",
    thumbnail_video: "FjfHkMt7rXY",
    lessons: [
      { title: "Introdução à Prática Baseada em Evidências (PBE)", id: "FjfHkMt7rXY", duration: 361 },
      { title: "Preferências do Paciente na PBE", id: "nmyAENpSTyQ", duration: 352 },
      { title: "Melhor Evidência Disponível", id: "4WFbOHFbWqo", duration: 2277 },
      { title: "E se a evidência disponível for fraca?", id: "8_E5gOqAlAM", duration: 993 },
      { title: "O que mais importa é a EXPERTISE CLÍNICA?", id: "axreV1DS174", duration: 1212 },
      { title: "Quem ainda sustenta o veredito do Dodô em 2026?", id: "X_m3p8aM4tY", duration: 1121 },
      { title: "Redpill é Psicologia", id: "ph47OpJkqCQ", duration: 1629 },
      { title: "Por que o mundo não acaba?", id: "_LL0NzzPsFs", duration: 2116 },
    ],
  },
  {
    title: "Além do Espelho",
    slug: "alem-do-espelho",
    description: "Curso completo explorando filosofia, literatura, abstração, psicologia evolutiva, neurociência, ilusão e percepção.",
    category: "Epistemologia",
    thumbnail_video: "J0fg1G1OuvY",
    lessons: [
      { title: "Aula 1 - Além do Espelho", id: "J0fg1G1OuvY", duration: 4233 },
      { title: "Aula 2 - Filosofia e Literatura", id: "H68J6HQylNg", duration: 5475 },
      { title: "Aula 3 - Abstração", id: "nh4EBI0ZieQ", duration: 4417 },
      { title: "Aula 4 - Psicologia Evolutiva", id: "0xsaZ__GiMs", duration: 4908 },
      { title: "Aula 5 - Neurociência", id: "pU0NaFRFeCA", duration: 4957 },
      { title: "Aula 6 - Ilusão", id: "Z4hfWo5V11c", duration: 4611 },
      { title: "Aula 7 - Percepção", id: "RqkFegBv-3o", duration: 4910 },
    ],
  },
];

async function main() {
  console.log("Seeding courses...\n");

  for (const course of courses) {
    const totalMinutes = Math.round(
      course.lessons.reduce((sum, l) => sum + l.duration, 0) / 60
    );

    console.log(`Creating course: ${course.title} (${course.lessons.length} aulas, ${totalMinutes}min)`);

    // Insert course
    const [courseRow] = await supaInsert("courses", {
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnail_url: ytThumb(course.thumbnail_video),
      instructor_id: INSTRUCTOR_ID,
      is_free: true,
      price_cents: null,
      status: "published",
      category: course.category,
      total_duration_minutes: totalMinutes,
      certificate_enabled: true,
      exam_enabled: false,
      exam_passing_score: 70,
    });

    console.log(`  → Course ID: ${courseRow.id}`);

    // Insert single section
    const [section] = await supaInsert("sections", {
      course_id: courseRow.id,
      title: course.title,
      position: 0,
    });

    console.log(`  → Section ID: ${section.id}`);

    // Insert lessons
    for (let i = 0; i < course.lessons.length; i++) {
      const lesson = course.lessons[i];
      const [lessonRow] = await supaInsert("lessons", {
        section_id: section.id,
        title: lesson.title,
        video_url: `https://www.youtube.com/watch?v=${lesson.id}`,
        video_source: "youtube",
        duration_minutes: Math.round(lesson.duration / 60),
        position: i,
        is_preview: i === 0,
      });
      console.log(`    Aula ${i + 1}: ${lesson.title.substring(0, 50)}...`);
    }

    console.log(`  ✓ Done\n`);
  }

  console.log("All courses seeded successfully!");
}

main().catch(console.error);
