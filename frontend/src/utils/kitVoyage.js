import { jsPDF } from 'jspdf';

const ACCENT = [34, 139, 34];    // forest green
const DARK = [30, 30, 30];
const LIGHT = [245, 247, 242];
const MUTED = [110, 110, 110];

function addHeader(doc, title) {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BABIRESI', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('babiresi.com — Portail Touristique Côte d\'Ivoire', 14, 22);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 29);
}

function addSection(doc, y, title, lines) {
  if (y > 260) { doc.addPage(); addHeader(doc, 'Kit Voyage (suite)'); y = 42; }

  doc.setFillColor(...LIGHT);
  doc.roundedRect(10, y, 190, 8, 2, 2, 'F');
  doc.setTextColor(...ACCENT);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y + 6);
  y += 12;

  doc.setTextColor(...DARK);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');

  lines.forEach(line => {
    if (y > 275) { doc.addPage(); addHeader(doc, 'Kit Voyage (suite)'); y = 42; }
    if (typeof line === 'string') {
      const wrapped = doc.splitTextToSize(`• ${line}`, 182);
      doc.text(wrapped, 16, y);
      y += wrapped.length * 5.5;
    } else if (line.bold) {
      doc.setFont('helvetica', 'bold');
      doc.text(line.bold, 16, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    }
  });
  return y + 4;
}

function addFooter(doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...ACCENT);
    doc.line(10, 287, 200, 287);
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(`Babiresi — Kit Voyage Côte d'Ivoire | Page ${i}/${pages}`, 14, 292);
    doc.text('babiresi.com', 180, 292, { align: 'right' });
  }
}

export function generateKitVoyage({ request, quote }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const name = [request.first_name, request.last_name].filter(Boolean).join(' ') || 'Voyageur';
  const destination = request.destination_free_text || "Côte d'Ivoire";
  const arrivalDate = request.arrival_date || '—';
  const departureDate = request.departure_date || '—';
  const adults = request.adults_count || 1;
  const children = request.children_count || 0;
  const totalPersons = adults + children;
  const nationality = request.nationality || 'Non renseignée';
  const totalFCFA = quote?.total_fcfa ? `${Number(quote.total_fcfa).toLocaleString('fr-CI')} FCFA` : '—';

  addHeader(doc, `Kit Voyage — ${name}`);

  let y = 38;

  // Résumé du séjour
  doc.setFillColor(240, 248, 240);
  doc.roundedRect(10, y, 190, 28, 3, 3, 'F');
  doc.setTextColor(...ACCENT);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé de votre séjour', 14, y + 7);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Voyageur : ${name}`, 14, y + 14);
  doc.text(`Destination : ${destination}`, 14, y + 20);
  doc.text(`Dates : ${arrivalDate} → ${departureDate}`, 100, y + 14);
  doc.text(`Groupe : ${adults} adulte(s)${children > 0 ? ` + ${children} enfant(s)` : ''}`, 100, y + 20);
  if (totalFCFA !== '—') doc.text(`Total séjour : ${totalFCFA}`, 14, y + 26);
  y += 34;

  // ADMIN & VISA
  const isCI = nationality.toLowerCase().includes('ivoir') || nationality.toLowerCase() === 'ci';
  y = addSection(doc, y, '1. FORMALITÉS ADMINISTRATIVES & VISA', [
    isCI
      ? 'Ressortissant ivoirien — aucun visa requis pour entrer en Côte d\'Ivoire.'
      : `Nationalité détectée : ${nationality}`,
    !isCI && 'Vérifiez si votre pays bénéficie de la dispense de visa CEDEAO (gratuit pour pays membres).',
    !isCI && 'Sinon, demandez un visa touristique à l\'ambassade de Côte d\'Ivoire ou via evisa.gouv.ci',
    'Passeport valable au moins 6 mois après la date de retour.',
    'Une photocopie de votre passeport est recommandée (à garder séparément).',
    'Remplissez la fiche de débarquement à l\'arrivée à l\'Aéroport Félix-Houphouët-Boigny (ABJ).',
  ].filter(Boolean));

  // VACCINS & SANTÉ
  y = addSection(doc, y, '2. SANTÉ & VACCINS', [
    { bold: 'Vaccins obligatoires :' },
    'Fièvre jaune : OBLIGATOIRE — certificat international exigé à l\'entrée.',
    { bold: 'Vaccins recommandés :' },
    'Hépatite A & B, Typhoïde, Méningite, DTP (Diphtérie-Tétanos-Polio).',
    { bold: 'Prévention paludisme :' },
    'Antipaludéens recommandés (Malarone, Doxycycline) — consultez votre médecin 4 semaines avant.',
    'Emportez répulsifs anti-moustiques, vêtements longs le soir.',
    { bold: 'Eau :' },
    'Buvez uniquement de l\'eau en bouteille ou filtrée. Évitez les glaçons dans les restaurants.',
  ]);

  // MONNAIE & BUDGET
  const budgetPerPerson = request.budget_per_person || null;
  const totalBudget = budgetPerPerson ? `~${(budgetPerPerson * totalPersons).toLocaleString('fr-CI')} FCFA (${totalPersons} pers.)` : '—';
  y = addSection(doc, y, '3. MONNAIE & BUDGET', [
    'Monnaie locale : Franc CFA (XOF / FCFA). 1€ ≈ 655 FCFA.',
    'Retrait DAB disponibles à Abidjan (SGBCI, Ecobank, Bridge Bank).',
    'Mobile Money très répandu : Orange Money, MTN MoMo, Wave (paiements quotidiens).',
    'Cartes Visa/Mastercard acceptées dans les hôtels et grands restaurants.',
    'Prévoir du cash pour les maquis, marchés et transports locaux.',
    budgetPerPerson ? `Budget estimatif total : ${totalBudget}` : 'Budget non renseigné dans votre demande.',
    'Pourboire : non obligatoire, mais apprécié (5-10% au restaurant, 500-1000 FCFA pour les guides).',
  ].filter(Boolean));

  // TRANSPORT
  y = addSection(doc, y, '4. TRANSPORT', [
    { bold: 'Arrivée — Aéroport d\'Abidjan (ABJ) :' },
    'Port Bouet, situé à ~15 km du centre-ville. Navette officielle ou taxi agréé recommandé.',
    'Votre conseiller Babiresi peut organiser un transfert aéroport sur demande.',
    { bold: 'Déplacements inter-villes :' },
    'Wôyô (cars de voyage), UTB — réserver à l\'avance pour les longs trajets.',
    'Abidjan ↔ Yamoussoukro : 3h | Abidjan ↔ Man : 7h | Abidjan ↔ Korhogo : 9h',
    { bold: 'Abidjan :' },
    'Wôrô-Wôrô (taxi collectif), Taxi ordinaire (négocier le prix avant), Yango (application).',
    'Évitez les transports en commun la nuit.',
  ]);

  // SIM & CONNECTIVITÉ
  y = addSection(doc, y, '5. CARTE SIM & CONNECTIVITÉ', [
    'Opérateurs : Orange CI (meilleure couverture), MTN, Moov.',
    'SIM locale disponible à l\'aéroport et dans toutes les boutiques (pièce d\'identité requise).',
    'Forfait data 10 Go : ~5 000 FCFA chez Orange.',
    'Wi-Fi disponible dans la plupart des hôtels et restaurants à Abidjan.',
    'L\'appli Babiresi est disponible offline (PWA) — pensez à l\'installer avant de partir.',
  ]);

  // SÉCURITÉ
  y = addSection(doc, y, '6. SÉCURITÉ', [
    'Abidjan est globalement sûre pour les touristes dans les quartiers fréquentés.',
    'Évitez d\'afficher bijoux et téléphones en public dans les zones moins connues.',
    'Ne sortez pas seul la nuit dans des quartiers que vous ne connaissez pas.',
    'Déposez objets de valeur au coffre de votre hébergement.',
    'En cas d\'urgence — Police : 111 | SAMU : 185 | Pompiers : 180',
    'Ambassade de France Abidjan : +225 27 20 20 04 00',
  ]);

  // CODES CULTURELS
  y = addSection(doc, y, '7. CODES CULTURELS & PRATIQUES', [
    'La salutation est primordiale — prenez le temps de saluer avant toute demande.',
    'Lors de salutations formelles, serrez la main droite, parfois accompagnée de la gauche.',
    'Demandez toujours la permission avant de photographier des personnes.',
    'La tenue vestimentaire doit être respectueuse en milieu rural et dans les lieux religieux.',
    'La ponctualité est appréciée mais la flexibilité culturelle est de mise (\'temps ivoirien\').',
    'Marchander est attendu dans les marchés — mais avec le sourire et le respect.',
  ]);

  // CONTACTS UTILES
  y = addSection(doc, y, '8. CONTACTS D\'URGENCE & UTILES', [
    'Police secours : 111 | Gendarmerie : 113 | SAMU : 185',
    'Urgences Babiresi 24/7 : WhatsApp +225 XX XX XX XX XX',
    'Office Ivoirien du Tourisme (OIT) : +225 27 20 33 11 77',
    'Aéroport Félix-Houphouët-Boigny : +225 27 21 27 76 10',
    request.whatsapp_number ? `Votre numéro WhatsApp enregistré : ${request.whatsapp_number}` : '',
  ].filter(Boolean));

  addFooter(doc);
  doc.save(`Babiresi_Kit_Voyage_${name.replace(/\s+/g, '_')}.pdf`);
}
