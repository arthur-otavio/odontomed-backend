require('dotenv').config();

const { auth, db, FieldValue, Timestamp } = require('../api/data/firebase');

const businessHours = {
  mon: { open: true, start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  tue: { open: true, start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  wed: { open: true, start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  thu: { open: true, start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  fri: { open: true, start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  sat: { open: false, start: '08:00', end: '12:00', breaks: [] },
  sun: { open: false, start: '08:00', end: '12:00', breaks: [] },
};

async function ensureUser({ uid, email, password, name, role, profileId }) {
  try {
    await auth.getUser(uid);
  } catch (_error) {
    await auth.createUser({ uid, email, password, displayName: name });
  }
  await auth.setCustomUserClaims(uid, { role });
  await db.collection('users').doc(uid).set({
    email,
    name,
    role,
    profileId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function seed() {
  await db.collection('clinic_settings').doc('main').set({
    name: 'OdontoMed',
    legalName: 'OdontoMed Divinopolis',
    dataSourceNote: 'Dados de endereco e telefone confirmados pelo proprietario do projeto. Profissionais do seed sao demonstrativos.',
    address: {
      street: 'Av. Parana, 1740',
      district: 'Sao Jose',
      city: 'Divinopolis',
      state: 'MG',
      zipCode: '35501-170',
      country: 'Brasil',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Av.%20Parana%201740%20Sao%20Jose%20Divinopolis%20MG',
    },
    phone: '(37) 3214-5540',
    whatsapp: '(37) 3214-5540',
    timezone: 'America/Sao_Paulo',
    businessHours,
    lgpdContact: 'privacidade@odontomed.local',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const specialties = [
    ['clinica-geral', 'Clinica geral'],
    ['ortodontia', 'Ortodontia'],
    ['implantodontia', 'Implantodontia'],
    ['estetica', 'Estetica dental'],
    ['endodontia', 'Endodontia'],
  ];
  for (const [id, name] of specialties) {
    await db.collection('specialties').doc(id).set({ name, active: true }, { merge: true });
  }

  const professionals = [
    {
      id: 'dra-ana-paula-demo',
      name: 'Dra. Ana Paula Martins',
      cro: 'CRO-MG 00000',
      specialty: 'Clinica geral e estetica dental',
      bio: 'Profissional ficticia para demonstracao. Substitua pelo cadastro real no painel administrativo.',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
      treatments: ['Avaliacao odontologica', 'Limpeza', 'Clareamento'],
      workingDays: ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta'],
      workingHours: businessHours,
      active: true,
      demo: true,
    },
    {
      id: 'dr-lucas-demo',
      name: 'Dr. Lucas Henrique Silva',
      cro: 'CRO-MG 00000',
      specialty: 'Ortodontia',
      bio: 'Profissional ficticio para demonstracao. Dados reais devem ser administrados pela clinica.',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
      treatments: ['Aparelho ortodontico', 'Alinhadores', 'Manutencao ortodontica'],
      workingDays: ['Segunda', 'Quarta', 'Sexta'],
      workingHours: businessHours,
      active: true,
      demo: true,
    },
  ];
  for (const professional of professionals) {
    await db.collection('professionals').doc(professional.id).set({
      ...professional,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('schedules').doc(professional.id).set({
      professionalId: professional.id,
      workingHours: professional.workingHours,
      workingDays: professional.workingDays,
      slotStepMinutes: 30,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const procedures = [
    { id: 'avaliacao', name: 'Avaliacao odontologica', description: 'Consulta inicial para avaliacao e plano de atendimento.', durationMinutes: 30, price: null, professionalIds: professionals.map((p) => p.id), active: true },
    { id: 'limpeza', name: 'Limpeza dental', description: 'Profilaxia e orientacao preventiva.', durationMinutes: 45, price: null, professionalIds: ['dra-ana-paula-demo'], active: true },
    { id: 'clareamento', name: 'Clareamento dental', description: 'Procedimento estetico com avaliacao profissional.', durationMinutes: 60, price: null, professionalIds: ['dra-ana-paula-demo'], active: true },
    { id: 'ortodontia', name: 'Consulta ortodontica', description: 'Avaliacao para aparelho ou alinhadores.', durationMinutes: 45, price: null, professionalIds: ['dr-lucas-demo'], active: true },
  ];
  for (const procedure of procedures) {
    await db.collection('procedures').doc(procedure.id).set({
      ...procedure,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await ensureUser({ uid: 'admin-demo', email: 'admin@odontomed.local', password: 'Admin@123456', name: 'Administrador OdontoMed', role: 'ADMINISTRADOR', profileId: 'admin-demo' });
  await ensureUser({ uid: 'paciente-demo', email: 'paciente@odontomed.local', password: 'Paciente@123456', name: 'Joao Paciente Demo', role: 'PACIENTE', profileId: 'paciente-demo' });

  await db.collection('patients').doc('paciente-demo').set({
    name: 'Joao Paciente Demo',
    email: 'paciente@odontomed.local',
    phone: '(37) 99999-0000',
    document: '000.000.000-00',
    active: true,
    demo: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  await db.collection('appointments').doc('consulta-demo').set({
    patientId: 'paciente-demo',
    patientName: 'Joao Paciente Demo',
    professionalId: 'dra-ana-paula-demo',
    professionalName: 'Dra. Ana Paula Martins',
    procedureId: 'avaliacao',
    procedureName: 'Avaliacao odontologica',
    startsAt: Timestamp.fromDate(tomorrow),
    endsAt: Timestamp.fromDate(new Date(tomorrow.getTime() + 30 * 60000)),
    status: 'CONFIRMADO',
    demo: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Seed concluido. Admin: admin@odontomed.local / Admin@123456');
}

seed().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
