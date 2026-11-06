// The two FICTIONAL test businesses. All names, addresses and prices are made up.
// Fixed IDs let the seed script safely re-run (it replaces these two businesses).

export interface SeedBusiness {
  id: string;
  name: string;
  industry: string;
  timezone: string;
  aiPersonality: string;
  customInstructions: string;
  // day: 0 = Sunday ... 6 = Saturday. Times are in the business's own timezone.
  hours: { day: number; open: string; close: string }[];
  services: { name: string; description: string; priceCents: number; durationMinutes: number }[];
  faqs: { question: string; answer: string }[];
  policies: { title: string; content: string }[];
  resources: string[];
}

export const SEED_BUSINESSES: SeedBusiness[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Sunrise Hair Studio",
    industry: "hair salon",
    timezone: "Australia/Melbourne",
    aiPersonality:
      "Warm, friendly and relaxed. Use casual Australian English and keep replies short. One light emoji per message is fine.",
    customInstructions:
      "Only discuss Sunrise Hair Studio. If asked about a stylist, you can mention that bookings are made on Chair 1 (Mia) or Chair 2 (Jack). Never recommend hair products, because we have not given you a product list.",
    hours: [
      { day: 2, open: "09:00", close: "17:30" },
      { day: 3, open: "09:00", close: "17:30" },
      { day: 4, open: "09:00", close: "20:00" },
      { day: 5, open: "09:00", close: "17:30" },
      { day: 6, open: "08:30", close: "15:00" },
    ],
    services: [
      { name: "Women's Cut & Style", description: "Consultation, wash, cut and blow-dry.", priceCents: 8500, durationMinutes: 60 },
      { name: "Men's Cut", description: "Consultation, wash and cut.", priceCents: 5000, durationMinutes: 30 },
      { name: "Kids' Cut (under 12)", description: "Cut and style for children under 12.", priceCents: 3500, durationMinutes: 30 },
      { name: "Blow Dry", description: "Wash and blow-dry.", priceCents: 6000, durationMinutes: 45 },
      { name: "Full Colour", description: "Single-process colour including toner.", priceCents: 18000, durationMinutes: 120 },
    ],
    faqs: [
      { question: "Where are you located?", answer: "We are at 12 Example Street, Fitzroy VIC 3065." },
      { question: "Is there parking?", answer: "Yes. There is free parking behind the salon, entered from Lyle Lane." },
      { question: "Do you take walk-ins?", answer: "Walk-ins are welcome Tuesday to Friday when a chair is free. Booking is recommended, especially on Saturdays." },
      { question: "Do I need a patch test before colour?", answer: "First-time colour clients need a free patch test at least 48 hours before their colour appointment." },
    ],
    policies: [
      { title: "Cancellation policy", content: "We need 24 hours' notice to cancel or reschedule. Cancellations with less than 24 hours' notice are charged 50% of the service price. No-shows are charged in full." },
      { title: "Late arrivals", content: "If you arrive more than 15 minutes late, we may need to shorten your service or reschedule it." },
    ],
    resources: ["Chair 1 (Mia)", "Chair 2 (Jack)"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Peak Performance Physio",
    industry: "physiotherapy",
    timezone: "Australia/Perth",
    aiPersonality:
      "Professional, calm and reassuring. Use clear, concise sentences. Do not use emoji.",
    customInstructions:
      "Only discuss Peak Performance Physio. Never diagnose a condition or give medical advice; suggest booking an appointment so a physiotherapist can assess the person. If someone describes a medical emergency, tell them to call 000 immediately.",
    hours: [
      { day: 1, open: "07:00", close: "12:00" },
      { day: 1, open: "14:00", close: "19:00" },
      { day: 2, open: "07:00", close: "12:00" },
      { day: 2, open: "14:00", close: "19:00" },
      { day: 3, open: "07:00", close: "12:00" },
      { day: 3, open: "14:00", close: "19:00" },
      { day: 4, open: "07:00", close: "12:00" },
      { day: 4, open: "14:00", close: "19:00" },
      { day: 5, open: "07:00", close: "12:00" },
      { day: 5, open: "14:00", close: "19:00" },
      { day: 6, open: "08:00", close: "12:00" },
    ],
    services: [
      { name: "Initial Consultation", description: "Full assessment and treatment plan for new patients.", priceCents: 14000, durationMinutes: 60 },
      { name: "Follow-up Appointment", description: "Ongoing treatment for existing patients.", priceCents: 9500, durationMinutes: 30 },
      { name: "Sports Massage", description: "Deep tissue massage for athletes and active people.", priceCents: 11000, durationMinutes: 45 },
      { name: "Dry Needling Session", description: "Dry needling treatment for muscle pain and tightness.", priceCents: 12000, durationMinutes: 30 },
    ],
    faqs: [
      { question: "Where are you located?", answer: "We are at 8 Sample Road, Subiaco WA 6008." },
      { question: "Is there parking?", answer: "There is no on-site parking. There is 2-hour street parking out the front and a public car park one block away." },
      { question: "Do you offer HICAPS and health fund claiming?", answer: "Yes. We offer on-the-spot HICAPS claiming for most major private health funds. Your rebate depends on your fund and level of cover." },
      { question: "Do I need a referral?", answer: "No referral is needed to see us." },
      { question: "What should I bring or wear?", answer: "Wear comfortable clothing you can move in, and bring any scans or reports related to your injury." },
    ],
    policies: [
      { title: "Cancellation policy", content: "We need 48 hours' notice to cancel or reschedule. Cancellations with less than 48 hours' notice incur a $75 late cancellation fee." },
      { title: "Late arrivals", content: "If you arrive more than 10 minutes late, your treatment time may be shortened." },
      { title: "AI assistant limits", content: "The online assistant can share clinic information and help with bookings. It cannot give medical advice or diagnoses." },
    ],
    resources: ["Room 1", "Room 2"],
  },
];
