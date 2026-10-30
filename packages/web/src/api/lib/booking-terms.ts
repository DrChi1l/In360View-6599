/**
 * Booking terms and the privacy & data-retention notice shown in the booking
 * pop-up. Shared by the web pop-up, the public /terms page and the server, so
 * the version a customer agreed to is always the version the server checks.
 *
 * Bump the version strings whenever the wording changes in substance — every
 * booking stores the versions it was submitted under.
 */

export const BOOKING_TERMS_VERSION = "booking-terms-2026-10-v1";
export const PRIVACY_NOTICE_VERSION = "privacy-retention-2026-10-v1";
export const LEGAL_UPDATED = "11 October 2026";

/** Booking requests that never became a confirmed visit. */
export const UNCONFIRMED_RETENTION_MONTHS = 12;
/** Confirmed and completed bookings, and the reports they produce. */
export const COMPLETED_RETENTION_YEARS = 6;

export const CONTACT_EMAIL = "in360view@outlook.com";
export const CONTACT_PHONE = "07990 060618";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: [string, string]; rows: [string, string][] };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

/** The short version shown at the top of the pop-up, before the full text. */
export const KEY_POINTS: string[] = [
  "Sending this form is a booking request. A contract only exists once we confirm the visit by email.",
  "No payment is taken online. Fees follow our current price list or written quote and are invoiced after the visit, payable within 14 days.",
  "Cancelling with less than 24 hours' notice may cost 50% of the fee; a visit we cannot carry out because of access problems may be charged in full.",
  "We use your details, the property details and any tenant details only to arrange and carry out the inventory or inspection, produce the report and deal with questions or disputes about it.",
  `Booking requests that do not go ahead are deleted automatically after ${UNCONFIRMED_RETENTION_MONTHS} months. Confirmed bookings and the reports they produce are kept for ${COMPLETED_RETENTION_YEARS} years, because reports are relied on as evidence in deposit disputes and claims, and are then deleted.`,
  "We never sell your data or use it for marketing, and you can ask to see, correct or delete it at any time.",
];

export const BOOKING_TERMS: LegalSection[] = [
  {
    id: "about",
    title: "1. About us and these terms",
    blocks: [
      p(
        `These terms apply when you book an inventory, check-in, check-out or inspection with In360View ("we", "us", "our") through this website. You can contact us by email at ${CONTACT_EMAIL} or by phone on ${CONTACT_PHONE}.`,
      ),
      p(
        '"You" means the person submitting the booking — a landlord, letting or managing agent, or someone authorised to act for them. If you book on behalf of a business or another person, you confirm that you have authority to accept these terms on their behalf.',
      ),
      p(
        "Some parts of these terms apply differently depending on whether you are a consumer (an individual booking for purposes outside a trade or business, such as a private landlord letting a single home) or a business. Where a term applies to only one of these, it says so.",
      ),
    ],
  },
  {
    id: "booking",
    title: "2. Booking requests and confirmation",
    blocks: [
      p(
        "Submitting the booking form is a request for a visit; it is not a guaranteed appointment. The date and time you choose is your preferred slot.",
      ),
      p(
        "A contract between you and us is formed only when we confirm the booking to you by email. We may offer an alternative date or time, ask for more information, or decline a request — for example, where the property is outside our service area or no inspector is available. If we decline, no contract is formed and nothing is payable.",
      ),
      p(
        "Please check the details in your confirmation and tell us straight away if anything is wrong. We are entitled to rely on the information you give us.",
      ),
    ],
  },
  {
    id: "services",
    title: "3. Our services",
    blocks: [
      p(
        "We prepare written and photographic records of the condition, cleanliness and contents of rental properties, including inventories, check-in reports, mid-term (interim) inspections and check-out reports, together with any extras you order such as 360° virtual tours.",
      ),
      p(
        "Our inspections are visual and non-invasive. We do not move heavy furniture or belongings, lift floor coverings, dismantle anything, or enter lofts, cellars or areas that cannot be reached safely from floor level. A report is not a structural survey, valuation, or a gas, electrical, fire-safety, legionella, HHSRS or other compliance certificate. The full disclaimer, safety notices and report conditions are included in every report and form part of these terms.",
      ),
      p(
        "We carry out our services with reasonable care and skill. Where we record that an item was not tested or could not be inspected, we are not responsible for its condition.",
      ),
    ],
  },
  {
    id: "responsibilities",
    title: "4. Your responsibilities",
    blocks: [
      p("To allow us to carry out the visit, you agree to:"),
      list(
        "give accurate and complete information, including the full address and postcode, the number of bedrooms and bathrooms, the furnishing level and the type of report required;",
        "make sure that you are the owner of the property or are authorised by the owner to instruct us;",
        "arrange lawful access — where the property is occupied, give the tenant or occupier the notice required by their tenancy agreement and the law (usually at least 24 hours in writing for a routine inspection) and tell them about the visit;",
        "provide working keys, any access codes needed, and clear instructions on where to collect and return them;",
        "make sure the property is safe to enter, with working lighting and, wherever possible, power and water connected;",
        "tell us in advance about anything that could affect safety or access, such as animals, alarms, building works, hazards, or occupiers who may need support;",
        "for a check-out, supply the relevant inventory or check-in report. If none is supplied, we will use the most recent one held on record and may charge reasonable extra costs for any return visit or rewrite caused by a missing or incorrect report.",
      ),
    ],
  },
  {
    id: "keys",
    title: "5. Keys and access details",
    blocks: [
      p(
        "We take reasonable care of keys, fobs and access information entrusted to us and use them only to carry out your booking. Keys are returned as agreed in writing. Unless we have agreed otherwise in writing, we are not responsible for loss caused by keys being left at, or collected from, a third party you nominate.",
      ),
      p(
        "Please share alarm or key-safe codes only where they are needed for the visit, and change them once the visit or tenancy changeover is complete.",
      ),
    ],
  },
  {
    id: "prices",
    title: "6. Prices and payment",
    blocks: [
      p(
        "No payment is taken when you book. Our fees are those shown on our current price list on this website, or in a written quote, at the time we confirm your booking. Additional charges — for example same-day visits, extra bedrooms or bathrooms, travel outside our standard area, return visits, or large properties and HMOs — apply as shown on the price list or as agreed with you before the visit.",
      ),
      p(
        "We will invoice you after the visit. Invoices are payable within 14 days. If an invoice is not paid on time, we may suspend further work and, for business customers, claim interest and compensation as permitted by the Late Payment of Commercial Debts (Interest) Act 1998.",
      ),
    ],
  },
  {
    id: "cancellation",
    title: "7. Changes, cancellations and abortive visits",
    blocks: [
      p(
        `You can ask to change or cancel a booking at any time by emailing ${CONTACT_EMAIL} or calling ${CONTACT_PHONE}. There is no charge if you give us at least 24 hours' notice before the confirmed appointment.`,
      ),
      list(
        "Cancellation or rescheduling with less than 24 hours' notice may be charged at 50% of the agreed fee, to cover the inspector's time that can no longer be rebooked.",
        "If the inspector attends but cannot carry out the visit — because keys are unavailable, access is refused or delayed by more than 30 minutes, or the property is unsafe — the visit may be treated as abortive and charged at the full fee.",
        "We may need to rearrange a visit because of illness, severe weather or other events outside our reasonable control. If so, we will tell you as soon as we can and offer a new slot; if the new slot does not suit you, you may cancel without charge.",
      ),
      p(
        "These charges reflect a genuine estimate of our loss and do not affect your statutory rights as a consumer described in section 8.",
      ),
    ],
  },
  {
    id: "consumer",
    title: "8. Your right to cancel if you are a consumer",
    blocks: [
      p(
        "If you are a consumer, the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 give you the right to cancel this contract within 14 days of the day we confirm your booking, without giving a reason. To cancel, tell us clearly by email or phone using the contact details above.",
      ),
      p(
        "If you ask us to carry out the visit within those 14 days, you are asking us to start the service during the cancellation period. If you then cancel after the visit has started but before the report is complete, you must pay a proportionate amount for the service provided up to the time you tell us. Once the service has been fully performed, the right to cancel no longer applies.",
      ),
      p(
        "Nothing in these terms affects your legal rights as a consumer, including your rights under the Consumer Rights Act 2015 for services to be carried out with reasonable care and skill.",
      ),
    ],
  },
  {
    id: "reports",
    title: "9. Reports, checking period and tenant review",
    blocks: [
      p(
        "We aim to issue reports promptly after the visit. You may ask us to correct a factual inaccuracy within seven (7) days of the report being issued. After that period the report is treated as agreed by those who received it, whether or not it has been signed. Once signed, a report is locked; any later correction is issued as a separate, referenced addendum.",
      ),
      p(
        "Where you ask us to, we will send the tenant a secure review link so that they can add comments, photographs and a signature. The tenant's response is stored alongside, and never alters, the inspector's original record.",
      ),
      p(
        "Reports may be shared with the landlord, tenant, managing agent, a tenancy deposit scheme adjudicator, insurer or court. They must not be edited, re-branded or published in part in a way that misrepresents their findings.",
      ),
    ],
  },
  {
    id: "liability",
    title: "10. Our liability",
    blocks: [
      p(
        "We are responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill. We are not responsible for loss that was not foreseeable, for matters excluded by the report disclaimer, for latent or concealed defects, or for the outcome of any deposit dispute, which is decided by the adjudicator or court.",
      ),
      p(
        "If you are a business customer, we are not liable for loss of profit, rent, business or opportunity, or any indirect or consequential loss, and our total liability arising from a booking is limited to the fee paid or payable for that booking.",
      ),
      p(
        "Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for any other liability that cannot lawfully be limited or excluded.",
      ),
    ],
  },
  {
    id: "complaints",
    title: "11. Complaints",
    blocks: [
      p(
        `If you are unhappy with our service, please contact us at ${CONTACT_EMAIL}. We will acknowledge your complaint within five working days and give you a full response within 21 days. If we cannot resolve it, we will tell you about any redress scheme available to you.`,
      ),
    ],
  },
  {
    id: "data",
    title: "12. Personal data",
    blocks: [
      p(
        "We handle the personal data in your booking as described in the Privacy & Data Retention Notice below, which forms part of the information you agree to have read when you book.",
      ),
    ],
  },
  {
    id: "general",
    title: "13. General",
    blocks: [
      p(
        "The version of these terms shown when you submit a booking applies to that booking. We may update these terms for future bookings; the date and version are shown at the top.",
      ),
      p(
        "If any part of these terms is found to be unenforceable, the rest remains in effect. No one other than you and us has any right to enforce these terms. If we do not insist on a term straight away, we can still insist on it later.",
      ),
      p(
        "These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. If you are a consumer living in Scotland or Northern Ireland, you may also bring proceedings in your local courts.",
      ),
    ],
  },
];

export const PRIVACY_NOTICE: LegalSection[] = [
  {
    id: "who",
    title: "1. Who is responsible for your data",
    blocks: [
      p(
        `In360View is the controller of the personal data submitted through this booking form and used to manage your booking. If you have a question about your data, contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}.`,
      ),
      p(
        "Where a letting agent or landlord instructs us to prepare a report about a tenancy, that client generally decides why the tenancy records are needed and acts as controller of the report data, and we process it on their instructions. In both cases we follow the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
      ),
    ],
  },
  {
    id: "collect",
    title: "2. What we collect",
    blocks: [
      list(
        "Your details: name, email address and phone number, and the organisation you act for if relevant.",
        "Property and booking details: the property address, furnishing level, service type, preferred date and time, and any keys or access notes you give us.",
        "Tenant or occupier details, if you choose to give them: name, email address and phone number.",
        "A record of your agreement: the versions of these terms and this notice that you accepted, and the date and time you accepted them.",
        "Information created when we carry out the service: photographs and video of the property (which may incidentally show personal belongings), written condition entries, meter readings, signatures, and any comments or photographs a tenant adds through a review link.",
        "Our correspondence with you, and invoicing and payment records.",
      ),
      p(
        "Please do not include sensitive information — for example about health, disability or anyone's circumstances — in free-text fields unless it is genuinely needed for the visit, such as a request for an occupier needing support. If you do, we use it only to arrange the visit safely.",
      ),
    ],
  },
  {
    id: "why",
    title: "3. Why we use it and our lawful basis",
    blocks: [
      {
        kind: "table",
        head: ["Purpose", "Lawful basis under UK GDPR"],
        rows: [
          [
            "Reviewing your request, confirming the visit, contacting you, and carrying out the inventory or inspection",
            "Performing a contract with you, or taking steps you ask for before entering one (Article 6(1)(b)). Where you book for a business, our legitimate interest in providing the service to our client (Article 6(1)(f)).",
          ],
          [
            "Contacting a tenant or occupier about access, and sending them a review link where you ask us to",
            "Legitimate interests — ours and yours — in arranging access and producing an accurate, fair record of the property (Article 6(1)(f)).",
          ],
          [
            "Keeping reports, photographs and signatures so that they can be relied on in deposit disputes, insurance claims or legal proceedings",
            "Legitimate interests in establishing, exercising or defending legal claims (Article 6(1)(f)).",
          ],
          [
            "Keeping a record of the terms you agreed to",
            "Legitimate interests in being able to show what was agreed and when (Article 6(1)(f)).",
          ],
          [
            "Invoicing, accounts and tax records",
            "Legal obligation (Article 6(1)(c)) and performing our contract with you.",
          ],
        ],
      },
      p(
        "We do not rely on consent for these purposes, because the processing is needed to provide the service you are booking. Ticking the box in the booking pop-up confirms that you have read this notice — including how long we keep your data — and agree to the booking terms. It does not limit any of your rights below.",
      ),
      p(
        "We do not sell personal data, use it for marketing, or make decisions about anyone based solely on automated processing.",
      ),
    ],
  },
  {
    id: "third-party",
    title: "4. Tenant and other third-party details",
    blocks: [
      p(
        "If you give us details about a tenant, occupier or another person, you confirm that you are entitled to share them with us for this purpose and that you will tell that person their details have been passed to In360View and where they can read this notice. Give only the details we need to arrange access and, if requested, send a review link.",
      ),
    ],
  },
  {
    id: "share",
    title: "5. Who we share it with",
    blocks: [
      list(
        "The parties to the report as you instruct — the landlord, managing or letting agent, and tenant.",
        "Service providers that run our systems on our instructions under contract, such as website hosting, database, secure file storage and email delivery providers.",
        "Tenancy deposit schemes and adjudicators, insurers, courts and our professional advisers, where a report or record is needed to deal with a dispute or claim.",
        "Regulators, the police or other authorities where the law requires us to.",
      ),
      p(
        "Some of our service providers may store or process data outside the UK. Where they do, we make sure the transfer is covered by UK adequacy regulations or appropriate safeguards, such as the UK International Data Transfer Agreement or Addendum.",
      ),
    ],
  },
  {
    id: "retention",
    title: "6. How long we keep it",
    blocks: [
      p(
        "We keep personal data only for as long as we need it to provide the service and to deal with questions or disputes about the report afterwards. Tenancy deposit disputes and claims can arise years after a visit — a claim for breach of contract can generally be brought for up to six years — which is why completed records are kept for that period.",
      ),
      {
        kind: "table",
        head: ["Record", "How long we keep it"],
        rows: [
          [
            "Booking requests that are never confirmed, are declined or do not go ahead",
            `${UNCONFIRMED_RETENTION_MONTHS} months from the date the request was submitted, then deleted automatically.`,
          ],
          [
            "Confirmed and completed booking records, including your record of agreement",
            `${COMPLETED_RETENTION_YEARS} years from the last update to the booking (normally completion of the service), then deleted automatically.`,
          ],
          [
            "Inventory and inspection reports, photographs, signatures, tenant comments and the related property and contact details",
            `${COMPLETED_RETENTION_YEARS} years from the end of the tenancy they relate to — or from the report date, if we are not told when the tenancy ended. We review these records at least once a year and then securely delete or anonymise them.`,
          ],
          [
            "Booking emails and correspondence",
            "For the same period as the booking or report they relate to, then deleted.",
          ],
          [
            "Invoices and accounting records",
            "For as long as tax and company law requires, normally six years from the end of the financial year they relate to.",
          ],
        ],
      },
      p(
        "We may keep a record for longer only where it is needed for an ongoing dispute, complaint, claim or investigation, or where the law requires it, and only until that matter ends. Deleted data may remain in encrypted backups for a short time until it is overwritten in the normal backup cycle; it is not used or restored in the meantime.",
      ),
    ],
  },
  {
    id: "security",
    title: "7. How we protect it",
    blocks: [
      p(
        "Data is sent over encrypted connections and stored with providers that use industry-standard security. Access is limited to people who need it to carry out our work. Tenant review links contain an unguessable code, and only a scrambled (hashed) form of that code is stored.",
      ),
    ],
  },
  {
    id: "rights",
    title: "8. Your rights",
    blocks: [
      p("You — and any tenant or other person whose details are given to us — have the right to:"),
      list(
        "ask for a copy of the personal data we hold about you;",
        "ask us to correct data that is inaccurate or incomplete;",
        "ask us to delete your data, or restrict how we use it;",
        "object to our use of your data where we rely on legitimate interests;",
        "ask us to transfer data you gave us to another organisation, where this applies.",
      ),
      p(
        `To use any of these rights, contact ${CONTACT_EMAIL}. We will respond within one month. Some rights are limited — for example, we may need to keep a signed report to deal with a live deposit dispute — and if so we will explain why. Where we process report data on behalf of a letting agent or landlord, we may pass your request to them and help them respond.`,
      ),
    ],
  },
  {
    id: "complain",
    title: "9. Complaints about data",
    blocks: [
      p(
        "If you are unhappy with how we have handled your data, please contact us first so that we can try to put it right. You also have the right to complain to the Information Commissioner's Office (ICO) at ico.org.uk or on 0303 123 1113.",
      ),
    ],
  },
  {
    id: "changes",
    title: "10. Changes to this notice",
    blocks: [
      p(
        "We will update this notice if the way we use personal data changes. The version and date are shown at the top, and each booking records the version that applied when it was made.",
      ),
    ],
  },
];
