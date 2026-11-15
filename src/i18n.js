// Statement words in the 6 languages (spec 5.7). The chosen language is printed first, English under it.
// {v} is the venue, {c} the contact. Kept short and plain. English "how" lines are built in docs.js; the others use
// gs/all (group or everyone, then {m} the method and {d} day by day) and the y* lines, with the group in brackets.
var I18N = {
  English: { title: 'Tips statement', name: 'Name', period: 'Period', to: 'to', paid: 'Paid on', total: 'Tips shared at {v} this period', tronc: 'Paid through a tronc operator',
    agency: 'Agency', share: 'Your share', how: 'How your share was worked out', taxUK: 'Your share is before any tax and National Insurance, which go through payroll.',
    ask: 'Questions? Ask {c}.', taxIE: 'This is your written statement of tips and gratuities for this period. Your share is before any tax deducted through payroll.',
    askNone: 'Questions? Ask your manager.' },
  Spanish: { title: 'Resumen de propinas', name: 'Nombre', period: 'Periodo', to: 'a', paid: 'Pagado el', total: 'Propinas repartidas en {v} en este periodo', tronc: 'Pagado a través de un operador de tronc',
    agency: 'Agencia', share: 'Tu parte', how: 'Cómo se calculó tu parte', taxUK: 'Tu parte es antes de impuestos y National Insurance, que se descuentan en la nómina.',
    ask: '¿Dudas? Pregunta a {c}.', taxIE: 'Este es tu resumen escrito de propinas de este periodo. Tu parte es antes de los impuestos que se descuentan en la nómina.',
    askNone: '¿Dudas? Pregunta a tu responsable.',
    howWords: {'gs': '{g} reparte el {pct}% de las propinas {m}{d}.', 'all': 'Las propinas se reparten {m}{d}.', 'team': 'equipo', 'day': ', día a día', 'Hours': 'por horas trabajadas', 'Points': 'por puntos', 'Equal': 'a partes iguales', 'HP': 'por horas trabajadas por puntos', 'yHours': 'Trabajaste {h} de las {H} horas ({g}).', 'yPoints': 'Tienes {pt} de los {P} puntos ({g}).', 'yEqual': 'Personas que reparten: {n}, contándote a ti.', 'yHP': 'Horas × puntos: {h} × {pt} = {x} de {HP} ({g}).'} },
  Polish: { title: 'Zestawienie napiwków', name: 'Imię i nazwisko', period: 'Okres', to: 'do', paid: 'Wypłacono', total: 'Napiwki podzielone w {v} w tym okresie', tronc: 'Wypłacone przez operatora troncu',
    agency: 'Agencja', share: 'Twój udział', how: 'Jak obliczono Twój udział', taxUK: 'Twój udział jest przed podatkiem i National Insurance, które są potrącane w wypłacie.',
    ask: 'Pytania? Zapytaj: {c}.', taxIE: 'To jest Twoje pisemne zestawienie napiwków za ten okres. Twój udział jest przed podatkiem potrącanym w wypłacie.',
    askNone: 'Pytania? Zwróć się do kierownictwa.',
    howWords: {'gs': '{g} dzieli {pct}% napiwków {m}{d}.', 'all': 'Napiwki są dzielone {m}{d}.', 'team': 'zespół', 'day': ', dzień po dniu', 'Hours': 'według przepracowanych godzin', 'Points': 'według punktów', 'Equal': 'po równo', 'HP': 'według godzin pomnożonych przez punkty', 'yHours': 'Twoje godziny: {h} z {H} ({g}).', 'yPoints': 'Twoje punkty: {pt} z {P} ({g}).', 'yEqual': 'Liczba osób, które dzielą napiwki: {n}, w tym Ty.', 'yHP': 'Godziny × punkty: {h} × {pt} = {x} z {HP} ({g}).'} },
  Portuguese: { title: 'Resumo de gorjetas', name: 'Nome', period: 'Período', to: 'a', paid: 'Pago em', total: 'Gorjetas repartidas em {v} neste período', tronc: 'Pago através de um operador de tronc',
    agency: 'Agência', share: 'A sua parte', how: 'Como foi calculada a sua parte', taxUK: 'A sua parte é antes de impostos e National Insurance, que são descontados no salário.',
    ask: 'Dúvidas? Pergunte a {c}.', taxIE: 'Este é o seu resumo escrito de gorjetas deste período. A sua parte é antes dos impostos descontados no salário.',
    askNone: 'Dúvidas? Pergunte à gerência.',
    howWords: {'gs': '{g} reparte {pct}% das gorjetas {m}{d}.', 'all': 'As gorjetas são repartidas {m}{d}.', 'team': 'equipa', 'day': ', dia a dia', 'Hours': 'por horas trabalhadas', 'Points': 'por pontos', 'Equal': 'em partes iguais', 'HP': 'por horas trabalhadas vezes pontos', 'yHours': 'As suas horas: {h} de {H} ({g}).', 'yPoints': 'Os seus pontos: {pt} de {P} ({g}).', 'yEqual': 'Pessoas que repartem: {n}, incluindo você.', 'yHP': 'Horas × pontos: {h} × {pt} = {x} de {HP} ({g}).'} },
  Romanian: { title: 'Situația bacșișurilor', name: 'Nume', period: 'Perioada', to: 'până la', paid: 'Plătit pe', total: 'Bacșișuri împărțite la {v} în această perioadă', tronc: 'Plătit printr-un operator tronc',
    agency: 'Agenție', share: 'Partea ta', how: 'Cum a fost calculată partea ta', taxUK: 'Partea ta este înainte de impozit și National Insurance, care se rețin din salariu.',
    ask: 'Întrebări? Întreabă pe {c}.', taxIE: 'Aceasta este situația ta scrisă a bacșișurilor pentru această perioadă. Partea ta este înainte de impozitul reținut din salariu.',
    askNone: 'Întrebări? Întreabă conducerea.',
    howWords: {'gs': '{g} împarte {pct}% din bacșișuri {m}{d}.', 'all': 'Bacșișurile se împart {m}{d}.', 'team': 'echipa', 'day': ', zi de zi', 'Hours': 'după orele lucrate', 'Points': 'după puncte', 'Equal': 'în mod egal', 'HP': 'după orele lucrate înmulțite cu punctele', 'yHours': 'Orele tale: {h} din {H} ({g}).', 'yPoints': 'Punctele tale: {pt} din {P} ({g}).', 'yEqual': 'Persoane care împart bacșișurile: {n}, inclusiv tu.', 'yHP': 'Ore × puncte: {h} × {pt} = {x} din {HP} ({g}).'} },
  Italian: { title: 'Riepilogo mance', name: 'Nome', period: 'Periodo', to: 'al', paid: 'Pagato il', total: 'Mance divise da {v} in questo periodo', tronc: 'Pagato tramite un operatore tronc',
    agency: 'Agenzia', share: 'La tua quota', how: 'Come è stata calcolata la tua quota', taxUK: 'La tua quota è al lordo di tasse e National Insurance, trattenute in busta paga.',
    ask: 'Domande? Chiedi a {c}.', taxIE: 'Questo è il tuo riepilogo scritto delle mance di questo periodo. La tua quota è al lordo delle tasse trattenute in busta paga.',
    askNone: 'Domande? Chiedi al tuo responsabile.',
    howWords: {'gs': '{g} divide il {pct}% delle mance {m}{d}.', 'all': 'Le mance sono divise {m}{d}.', 'team': 'squadra', 'day': ', giorno per giorno', 'Hours': 'in base alle ore lavorate', 'Points': 'in base ai punti', 'Equal': 'in parti uguali', 'HP': 'in base alle ore lavorate per i punti', 'yHours': 'Le tue ore: {h} su {H} ({g}).', 'yPoints': 'I tuoi punti: {pt} su {P} ({g}).', 'yEqual': 'Persone che dividono le mance: {n}, te compreso o compresa.', 'yHP': 'Ore × punti: {h} × {pt} = {x} su {HP} ({g}).'} }
};
if (typeof module !== 'undefined' && module.exports) module.exports = I18N;
