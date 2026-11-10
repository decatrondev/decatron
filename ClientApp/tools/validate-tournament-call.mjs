import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const es = JSON.parse(read('ClientApp/public/locales/es/tournament-call.json'));
const en = JSON.parse(read('ClientApp/public/locales/en/tournament-call.json'));
const flatten = (object, prefix = '') => Object.fromEntries(Object.entries(object).flatMap(([key, value]) => {
    const name = prefix ? prefix + '.' + key : key;
    return typeof value === 'string' ? [[name, value]] : Object.entries(flatten(value, name));
}));
const dictionaries = [flatten(es), flatten(en)];
assert.deepEqual(Object.keys(dictionaries[0]).sort(), Object.keys(dictionaries[1]).sort(), 'ES/EN key parity');
const files = fs.readdirSync(path.join(root, 'ClientApp/src/pages/tournament-call')).filter(name => name.endsWith('.tsx')).map(name => 'ClientApp/src/pages/tournament-call/' + name);
files.push('ClientApp/src/pages/admin/TournamentCallAdmin.tsx');
files.push('ClientApp/src/pages/admin/CallApplicationsReview.tsx');
files.push('ClientApp/src/pages/admin/CallContributions.tsx');
const used = new Set(files.flatMap(name => [...read(name).matchAll(/\bt\('([\w.]+)'/g)].map(match => match[1])));
for (const key of ['destinationUnavailable', 'closed', 'open', 'failedHelp', 'testPayment', 'receivedConfirmed', 'reversedHelp', 'awaitingReview', 'paymentHelp', 'confirmOpen', 'confirmClose', 'closeDonations', 'openDonations']) used.add('funding.' + key);
for (const key of ['useTitle', 'useDescription', 'applyTitle', 'applyDescription', 'playTitle', 'playDescription', 'saveSuccess', 'publishSuccess', 'unpublishSuccess', 'officialImageAlt', 'officialCover']) used.add(key);
for (const [group, keys] of Object.entries({
    collaborationNext: ['title', 'moneyHelp', 'contribute', 'receipt', 'receiptHelp', 'closedHelp', 'deliveryHelp', 'followReview', 'awaitInstructions', 'reviewHelp', 'guide'],
    applicationStatus: ['pending', 'approved', 'rejected', 'withdrawn', 'all'],
    contributionTypes: ['money', 'vbucks', 'giftcard'], reviewActions: ['approved', 'rejected', 'pending'],
    applicationErrors: ['rules_changed', 'stale_revision', 'applications_closed', 'channel_not_owned', 'invalid_contribution', 'invalid_currency'],
    'funding.kinds': ['money', 'giftcard', 'item'],
    'funding.status': ['pending', 'confirmed', 'reversed'],
    'funding.confirm': ['confirmed', 'reversed'],
    'funding.paymentStates': ['prepared', 'processing', 'authenticating', 'charged', 'uncertain', 'failed'],
    'funding.actions': ['manual', 'review', 'payment_received', 'identity_withdrawn'],
    'funding.errors': ['invalid_contribution', 'invalid_currency', 'invalid_amount', 'consent_required', 'receipt_required', 'stale_revision', 'duplicate_reference', 'invalid_payment', 'invalid_application', 'already_reversed', 'payment_identity_locked', 'donations_closed', 'intent_expired', 'invalid_retry', 'provider_amount_limit', 'payment_review_required', 'payment_unavailable', 'payment_configuration_changed', 'payment_declined', 'not_found', 'save_failed'],
})) for (const key of keys) used.add(group + '.' + key);
for (const dictionary of dictionaries) {
    for (const [key, value] of Object.entries(dictionary)) assert.ok(value.trim(), 'Empty translation: ' + key);
    for (const key of used) assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), 'Missing translation: ' + key);
}
for (const name of ['docs/TOURNAMENT_CALL.md', 'docs/es/TOURNAMENT_CALL.md']) {
    const text = read(name);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^https?:/.test(match[1])) continue;
        assert.ok(fs.existsSync(path.resolve(root, path.dirname(name), match[1])), 'Broken documentation link: ' + match[1]);
    }
    for (const route of ['/convocatorias/fortnite-streamers', '/admin/convocatorias', '/docs/convocatorias']) assert.ok(text.includes(route), 'Missing documented route: ' + route);
}
assert.ok(read('ClientApp/src/App.tsx').includes('TournamentCallGuide'), 'Public guide is not registered');
assert.ok(fs.existsSync(path.join(root, 'ClientApp/public/images/tournament-call/fortnite-island.jpg')), 'Cover missing');
console.log(`Convocatoria: ES/EN, ${used.size} claves verificadas, 0 faltantes; enlaces y rutas de documentación correctos.`);
