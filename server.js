const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.MALABI_NOTIFICATION_EMAIL || 'malabiexclusivelodges@gmail.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, message: 'Too many enquiries from this connection. Please try again later.' }
});

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const allowedRooms = new Set([
  'No preference',
  'Premium Room',
  'Executive Room',
  'Deluxe Room',
  'Family Room'
]);

const allowedGuests = new Set(['1', '2', '3', '4+']);

function validateEnquiry(body) {
  const name = clean(body.name, 100);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 60);
  const checkin = clean(body.checkin, 10);
  const checkout = clean(body.checkout, 10);
  const guests = clean(body.guests, 10);
  const room = clean(body.room, 50);
  const message = clean(body.message, 2000);
  const website = clean(body.website, 200);
  const errors = [];
  if (!name || name.length < 2) errors.push('Please provide your full name.');
  if (!email && !phone) errors.push('Please provide an email address or phone/WhatsApp number.');
  if (email && !isValidEmail(email)) errors.push('Please provide a valid email address.');
  if (checkin && !isValidDate(checkin)) errors.push('Please provide a valid check-in date.');
  if (checkout && !isValidDate(checkout)) errors.push('Please provide a valid check-out date.');
  if (checkin && checkout && isValidDate(checkin) && isValidDate(checkout) && checkout <= checkin) errors.push('Check-out must be after check-in.');
  if (guests && !allowedGuests.has(guests)) errors.push('Invalid guest count.');
  if (room && !allowedRooms.has(room)) errors.push('Invalid room preference.');
  if (website) errors.push('Spam check failed.');
  return { errors, data: { name, email, phone, checkin, checkout, guests: guests || '2', room: room || 'No preference', message } };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function emailHtml(data) {
  const rows = [
    ['Guest', data.name], ['Email', data.email || 'Not provided'], ['Phone / WhatsApp', data.phone || 'Not provided'],
    ['Check-in', data.checkin || 'Not specified'], ['Check-out', data.checkout || 'Not specified'], ['Guests', data.guests],
    ['Room preference', data.room], ['Message', data.message || 'No message']
  ];
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#1d2a25"><h2>New Booking Enquiry — Malabi Exclusive Lodges</h2><table cellpadding="8" cellspacing="0" border="0">${rows.map(([label,value]) => `<tr><td style="font-weight:700;vertical-align:top">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p style="color:#68756f;font-size:13px">Submitted through the Malabi website.</p></body></html>`;
}

function emailText(data) {
  return ['NEW BOOKING ENQUIRY — MALABI EXCLUSIVE LODGES', '', `Guest: ${data.name}`, `Email: ${data.email || 'Not provided'}`, `Phone / WhatsApp: ${data.phone || 'Not provided'}`, `Check-in: ${data.checkin || 'Not specified'}`, `Check-out: ${data.checkout || 'Not specified'}`, `Guests: ${data.guests}`, `Room preference: ${data.room}`, `Message: ${data.message || 'No message'}`].join('\n');
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'malabi-backend' }));

app.post('/api/enquiry', enquiryLimiter, async (req, res) => {
  const { errors, data } = validateEnquiry(req.body || {});
  if (errors.length) return res.status(400).json({ ok: false, message: errors[0], errors });
  if (!RESEND_API_KEY || !FROM_EMAIL) return res.status(503).json({ ok: false, message: 'The enquiry service is temporarily unavailable. Please contact Malabi directly by phone or WhatsApp.' });
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to: [NOTIFICATION_EMAIL], subject: `New booking enquiry — ${data.room} — ${data.checkin || 'Date not specified'}`, html: emailHtml(data), text: emailText(data), replyTo: data.email || undefined });
    if (error) return res.status(502).json({ ok: false, message: 'We could not send your enquiry right now. Please try again or contact Malabi directly.' });
    return res.json({ ok: true, message: 'Your enquiry has been sent. Malabi will contact you shortly.' });
  } catch (error) {
    console.error('Enquiry error:', error);
    return res.status(500).json({ ok: false, message: 'Something went wrong while sending your enquiry. Please try again.' });
  }
});

const deluxeVideoSection = `
      <div class="room-film reveal room-film-inline">
        <div class="room-film-player">
          <video controls muted playsinline webkit-playsinline preload="auto" aria-label="Deluxe room video tour">
            <source src="/assets/images/Dulex%20Loom%20v2.mp4" type="video/mp4">
            Your browser does not support HTML video.
          </video>
          <div class="room-film-player-caption"><span>ROOM TOUR · MALABI EXCLUSIVE LODGES</span><span>DELUXE ROOM</span></div>
        </div>
        <div class="room-film-note"><p>Step inside the Deluxe Room.</p><span class="room-film-note-label">A CLOSER LOOK AT OUR DELUXE ROOMS.</span><a class="room-film-book" href="#booking">Ask about this room ↗</a></div>
      </div>`;

app.get('/', (_req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Keep the Deluxe video markup structurally identical to the other room-film sections.
  // This replaces only the existing Deluxe video block, leaving the rest of index.html untouched.
  const deluxeFilmPattern = /(<div class="room-gallery reveal deluxe-gallery">[\s\S]*?<\/div>)\s*<div class="room-film reveal room-film-inline">[\s\S]*?<\/section>\s*<!-- FAMILY ROOM -->/;
  if (deluxeFilmPattern.test(html)) {
    html = html.replace(deluxeFilmPattern, `$1${deluxeVideoSection}\n  </section>\n\n  <!-- FAMILY ROOM -->`);
  } else if (!html.includes('aria-label="Deluxe room video tour"')) {
    const deluxeGalleryPattern = /(<div class="room-gallery reveal deluxe-gallery">[\s\S]*?<\/div>)(\s*<\/div>\s*<\/section>)/;
    html = html.replace(deluxeGalleryPattern, `$1${deluxeVideoSection}$2`);
  }

  if (!html.includes('/assets/js/deluxe-video.js')) html = html.replace('</body>', '  <script src="/assets/js/deluxe-video.js"></script>\n</body>');
  res.send(html);
});

app.get('/assets/logo.webp', (_req, res) => res.sendFile(path.join(__dirname, 'assets', 'images', 'malabi-office-logo.png'), { headers: { 'Cache-Control': 'public, max-age=604800, immutable' } }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d', immutable: true }));
app.use((req, res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'API endpoint not found.' }); res.status(404).send('Page not found'); });
app.listen(PORT, () => console.log(`Malabi backend listening on ${PORT}`));
