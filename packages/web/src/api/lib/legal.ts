/**
 * Report legal copy — shared by the on-screen report view and the PDF, so the
 * two can never drift. Written for UK inventory/inspection practice.
 */

export const DECLARATION =
  "The parties named below confirm that they have read this report and agree that it is a fair and accurate record of the condition and contents of the property on the date of inspection. Once signed, this report is locked and cannot be altered.";

export const DISCLAIMER_INTRO =
  "This report is a record of the visual condition and contents of the property on the date of inspection only. It is prepared for the use of the landlord, the tenant and their appointed agent, and should be read together with the tenancy agreement.";

export const DISCLAIMER_POINTS: { title: string; body: string }[] = [
  {
    title: "Not a structural survey",
    body: "The inspection is visual and non-invasive. It is not a structural survey, valuation, or condition report on the fabric of the building, and no comment is made on the adequacy of construction, damp, subsidence, insulation or drainage.",
  },
  {
    title: "Nothing moved or dismantled",
    body: "Furniture, floor coverings, stored goods and heavy appliances are not moved, lifted or dismantled. Surfaces beneath and behind them are not inspected and no opinion is given on their condition.",
  },
  {
    title: "Inaccessible areas",
    body: "Lofts, cellars, outbuildings, locked rooms, sealed cupboards and any area not safely reachable from floor level are excluded unless specifically recorded in this report.",
  },
  {
    title: "Not a compliance or safety certificate",
    body: "This report is not a gas, electrical, EPC, legionella, fire safety or furniture-regulations certificate. Alarms, appliances, heating and services are only tested where this report expressly says they were, and then only for apparent operation on the day.",
  },
  {
    title: "Condition and cleanliness grading",
    body: "Condition and cleanliness are graded by visual assessment against the standard expected for a property of this type, age and furnishing level. Terms such as “good” or “clean” are comparative descriptions, not warranties.",
  },
  {
    title: "Photographs",
    body: "Photographs support the written entries and are illustrative rather than exhaustive. The absence of a photograph does not imply the absence of an entry, and colour may vary with lighting conditions.",
  },
  {
    title: "Items and quantities",
    body: "Contents are listed as presented. No comment is made on ownership, provenance, authenticity, age or value, and electrical or gas items are not PAT tested unless stated.",
  },
  {
    title: "Impartiality",
    body: "The inspecting clerk attends as an impartial third party and has no interest in the property or in the outcome of any deposit claim.",
  },
  {
    title: "Assumed good order",
    body: "Dilapidations, faults, breakages and soiling are recorded only where they were seen. Anything listed without comment is presumed to be in good order at the date of inspection, even where it is neither new nor perfect.",
  },
  {
    title: "Occupied properties",
    body: "Where the property is inspected with tenants in situ, it may not be possible to distinguish the landlord's contents from the tenant's own, or to view areas obstructed by belongings. Entries made in those circumstances may be incomplete, and validation by the landlord and tenant is strongly recommended.",
  },
];

export const TERMS_INTRO =
  "The following terms apply to the preparation, delivery and use of this report. Instructing In360View, attending the inspection or relying on this report constitutes acceptance of them.";

export const TERMS: { title: string; body: string }[] = [
  {
    title: "1. Scope of service",
    body: "In360View records the condition and contents of the property at the date and time of the inspection. The service does not include cleaning, repairs, removals, key cutting, compliance testing or dispute representation.",
  },
  {
    title: "2. Access and preparation",
    body: "The instructing party is responsible for providing safe and unobstructed access, working lighting and power, and confirming whether the property is occupied. Where access is refused, delayed by more than 30 minutes, or unsafe, the visit may be abandoned and a call-out charge may apply.",
  },
  {
    title: "3. Checking period",
    body: "Any request to correct or amend this report must be made in writing within seven (7) days of the report being issued. After that period the report is taken as agreed by all parties who received it, whether signed or not.",
  },
  {
    title: "4. Signatures and locking",
    body: "Once signed by a party the report is locked and no entry can be altered. A subsequent correction is issued as a separate addendum that references the original report.",
  },
  {
    title: "5. Photographs, data and retention",
    body: "Photographs, signatures and report data are stored securely and retained for six (6) years to support deposit and legal proceedings, then deleted. Personal data is processed as controller by the instructing party and as processor by In360View in line with UK GDPR; a subject access request should be sent to the instructing party in the first instance.",
  },
  {
    title: "6. Use of the report",
    body: "The report may be shared with the landlord, tenant, appointed agent, a deposit scheme adjudicator or a court. It may not be edited, re-branded, sold or published in part where doing so would misrepresent its findings.",
  },
  {
    title: "7. Liability",
    body: "In360View accepts liability for the accuracy of the entries recorded, but not for matters excluded by the disclaimer above, for latent or concealed defects, or for any loss of rent, deposit award or consequential loss. Save for death or personal injury caused by negligence, total liability is limited to the fee paid for the inspection.",
  },
  {
    title: "8. Fees and cancellation",
    body: "Fees are payable within 14 days of invoice. Cancellation with less than 24 hours' notice may be charged at 50% of the agreed fee, and an abandoned visit at the full fee.",
  },
  {
    title: "9. Complaints",
    body: "Complaints should be raised in writing and will be acknowledged within five working days and answered within 21 days.",
  },
  {
    title: "10. Governing law",
    body: "These terms are governed by the laws of England and Wales and are subject to the exclusive jurisdiction of its courts.",
  },
];

export const SAFETY_INTRO =
  "In360View reports record what the inspector could see and safely reach on the day. The notices below explain the limits of that record where health, safety and compliance are concerned, and the conventions used in the entries themselves.";

export const SAFETY_NOTICES: { title: string; body: string }[] = [
  {
    title: "Safety disclaimer",
    body: "Nothing in this report should be read as confirmation that any appliance, fitting, alarm, installation or item of furniture is safe, compliant or in working order. Entries are a record that the item was present in the property on the date of inspection, together with any comment on its apparent condition. No gas or electrical appliance is operated or tested for working order, and items may be recorded differently by a tenant after subsequent use.",
  },
  {
    title: "Not a qualified inspection",
    body: "The In360View inspector is not attending as a qualified electrician, gas engineer, HHSRS assessor, legionella risk assessor or fire safety expert, and is not required to report on anything that may contravene housing or safety legislation. Where something appears in the inspector's opinion to need attention from the landlord or their representative, it is noted as an observation only.",
  },
  {
    title: "Housing Health and Safety Rating System (HHSRS)",
    body: "The HHSRS was introduced under the Housing Act 2004 and is the risk-assessment approach local authorities use to judge housing conditions. It does not set minimum standards; it is concerned with avoiding or minimising potential hazards, and landlords and agents are encouraged to review conditions regularly. In360View inspectors are not qualified HHSRS assessors, but will apply government guidance and common sense to flag anything that appears to pose a risk to the health or safety of occupants or visitors. Such concerns are marked (++++) against the relevant entry.",
  },
  {
    title: "Furniture & Furnishings (Fire) (Safety) Regulations 1988, as amended 1993",
    body: "Relevant furniture and furnishings carrying an appropriate label complying with the regulations are recorded as \"fire resistant\". Where no label can be found and the landlord has not confirmed compliance, the entry is marked (****). This does not mean the item is non-compliant — only that no compliant label was seen at the time of inspection. Loose fireguards that are not part of a gas or electric fire are recorded as belonging to the appliance they appear to protect.",
  },
  {
    title: "Smoke and carbon monoxide alarms",
    body: "The presence and location of smoke and carbon monoxide alarms is recorded where they can be seen. Alarms are only tested where this report expressly states that they were tested, and a test confirms audible response on the day only — never the age, wiring, sensor life or regulatory compliance of the device. In360View is not responsible for the failure of any alarm after the inspection, nor for any monitored system activated during testing. After the tenancy begins it is the tenant's responsibility to test the alarms fitted in the property at regular intervals and to report any that do not respond.",
  },
  {
    title: "Utility meters",
    body: "Gas, electricity, water, oil and other utility readings, together with meter serial numbers, are recorded as a service only, and only where access is available, reasonable and safe. Meters, oil tanks or gas bottles found in an unsafe condition or in a difficult or inaccessible position are not recorded, and the reason is reported instead. Oil and propane levels are recorded from an external gauge or visual inspection; tanks are never dipped and levels are not estimated.",
  },
];

export const GUIDANCE_INTRO =
  "In360View produces a range of inspections and reports which differ in style and purpose. The notes below explain what each report is for and how it should be read, so that landlords, tenants, agents and adjudicators can rely on it consistently.";

export const GUIDANCE_NOTES: { title: string; body: string }[] = [
  {
    title: "The inventory",
    body: "An inventory lists and describes the components and contents of a property as seen at the time of inspection — a written and photographed snapshot used as the baseline for the property's condition and contents. Unless stated otherwise in brackets after an entry, a listed item is assumed to be in good order, though not necessarily new or perfect. Fair wear and tear is not assessed, although the inspector may comment on apparent age or use where it helps future identification.",
  },
  {
    title: "The check-in",
    body: "A check-in verifies the accuracy of the inventory at move-in, with any additional notes agreed by the inspector, the tenant or the tenant's representative. It is not a duplicate of, or a substitute for, an inventory: it accompanies one, recording anything that needs adding to or altering in it, and will normally include meter readings and the keys handed over at move-in. It may be issued with the inventory or separately, and supports any apportionment discussion at check-out.",
  },
  {
    title: "The mid-term",
    body: "Also known as a management or interim inspection, this is normally produced part-way through a tenancy. It reports on how the property is being looked after and raises problems found in the property, whether or not they were caused by the tenant. It may, though rarely, form part of a dispute at the end of the tenancy.",
  },
  {
    title: "The check-out",
    body: "A check-out identifies differences — better or worse — after the tenant vacates. It is not a duplicate inventory: it lists changes so that the landlord or their agent can decide whether a claim for damage, loss or cleanliness is appropriate. Where the client needs it, the inspector may note whether a change appears to be a tenant or landlord responsibility, or attributable to fair wear and tear, but will never offer an opinion on apportionment or value — that is for the landlord or their agent, often with supporting quotes or receipts. A relevant inventory must be supplied for a check-out to be carried out correctly; if none is provided, the most recent inventory on record is taken as correct and used as the reference, and reasonable additional costs may be charged for any revisit or rewrite caused by a missing or incorrect inventory. Tenants should return all listed items to their recorded locations before the check-out.",
  },
  {
    title: "Meter readings",
    body: "In360View inspectors will endeavour to record utility meter serial numbers and readings as a service, provided the meters are easy to find and safe to reach. Where a meter is inaccessible or presents a risk of injury, the reason is given in the report along with a suggestion for obtaining the reading. Inspectors will not climb to reach awkward locations, enter unsafe spaces, or read water meters in public or on-street locations.",
  },
  {
    title: "The In360View system",
    body: "Reports are produced, delivered and verified online rather than on paper. Clients can issue a report to the tenant through a coded link, allowing the tenant to review it on screen and add their own observations and photographs within the period the landlord or agent allows. In360View notifies tenants by email — and by text where the correct details are supplied — and time-stamps every message and response. This process does not alter anything recorded by the inspector; it sits alongside the tenant's right to verify the report in their own time after move-in.",
  },
  {
    title: "Observations on health and safety",
    body: "In360View inspectors are trained to recognise common housing health and safety issues and may issue supplementary observations where they believe a potential hazard exists. They are not environmental health officers, and any such observation is a heads-up on the possible consequences of non-compliance. Responsibility for the health and safety of tenants and visitors remains with the landlord or their representative at all times.",
  },
  {
    title: "Queries, complaints and redress",
    body: "Any query or assumed discrepancy about the description or content of this report should be raised with the inspector, or with In360View directly, within the checking period set out in the terms below. Complaints are acknowledged within five working days and answered within 21 days, and In360View follows the complaints procedure of the redress scheme it belongs to.",
  },
];

/** Captions/rooms that suggest a photo shows the outside front of the property. */
const FRONT_HINT = /front|frontage|exterior|external|outside|facade|façade|elevation|kerb|curb|street|garden|driveway|entrance|door/i;

/**
 * Picks the best candidate for the cover photograph: an exterior/front shot if
 * one can be identified, otherwise the first general photograph of the report.
 */
export function pickCoverPhoto<T extends { caption?: string | null; roomId?: string | null; itemId?: string | null }>(
  photos: T[],
  roomNameById: (roomId: string) => string | undefined = () => undefined,
): T | null {
  if (!photos.length) return null;
  const hinted = photos.find((p) => {
    const room = p.roomId ? roomNameById(p.roomId) : undefined;
    return FRONT_HINT.test(`${p.caption ?? ""} ${room ?? ""}`);
  });
  if (hinted) return hinted;
  const loose = photos.find((p) => !p.roomId && !p.itemId);
  return loose ?? photos[0] ?? null;
}
