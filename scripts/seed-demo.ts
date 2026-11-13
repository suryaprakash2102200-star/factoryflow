/**
 * Realistic demo data for a fictional engineering / fabrication shop in Pune.
 * Six months of enquiries → quotations → orders → production → dispatch → invoices,
 * plus the master lists (items, machines, units, GST, terms).
 *
 *   npm run db:demo            # fills the first workspace (Acme Engineering Works)
 *
 * It REPLACES that workspace's business records (customers, enquiries, quotes, orders,
 * jobs, invoices, tasks, masters). Users, roles and settings are kept.
 * All company and person names are made up.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const p = new PrismaClient();
const DAY = 86_400_000;
const NOW = Date.now();

// deterministic random so every run gives the same demo
let seed = 20261113;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const daysAgo = (d: number, h = int(9, 18)) => new Date(NOW - d * DAY - (NOW % DAY) + h * 3600_000);
const round = (n: number, step = 1) => Math.round(n / step) * step;
const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

// ── master data ─────────────────────────────────────────────────────────────

const LISTS: Record<string, [string, string, boolean?][]> = {
  unit: [["pcs", "Pieces (pcs)", true], ["nos", "Numbers (nos)"], ["set", "Set"], ["kg", "Kilogram (kg)"], ["mtr", "Metre (mtr)"], ["sqm", "Square metre (sqm)"], ["lot", "Lot"]],
  material: [["ms-is2062", "MS IS2062 E250"], ["ss304", "SS 304"], ["ss316", "SS 316"], ["en8", "EN8"], ["en19", "EN19"], ["al6061", "Aluminium 6061"], ["crca", "CRCA sheet"], ["gi", "GI sheet"]],
  gst_rate: [["0", "0% (exempt)"], ["5", "5%"], ["12", "12%"], ["18", "18%", true], ["28", "28%"]],
  payment_term: [
    ["adv100", "100% advance with PO"],
    ["adv50", "50% advance, balance before dispatch", true],
    ["net30", "30 days from invoice date"],
    ["net45", "45 days from invoice date"],
    ["lc", "Against LC at sight"],
  ],
  delivery_term: [["exw", "Ex-works Chakan, Pune", true], ["for", "FOR destination (freight included)"], ["door", "Door delivery, freight extra at actuals"]],
  product_category: [["fab", "Fabricated structures"], ["mach", "Machined components"], ["sheet", "Sheet metal"], ["conv", "Conveyor parts"], ["assy", "Assemblies"], ["svc", "Job work / services"]],
  machine_type: [["cnc", "CNC machining centre"], ["lathe", "CNC lathe"], ["laser", "Laser cutting"], ["press", "Press brake"], ["weld", "Welding bay"], ["paint", "Paint / powder coat"], ["drill", "Radial drill"]],
};

// code, name, category, unit, hsn, gst, price, material
const PRODUCTS: [string, string, string, string, string, number, number, string][] = [
  ["BRK-4040-MS", "MS angle bracket 40×40×5", "fab", "pcs", "7326", 18, 24, "MS IS2062 E250"],
  ["BRK-6565-MS", "MS angle bracket 65×65×6", "fab", "pcs", "7326", 18, 46, "MS IS2062 E250"],
  ["BPL-200-MS", "Base plate 200×200×12 with 4 holes", "fab", "pcs", "7326", 18, 310, "MS IS2062 E250"],
  ["STR-PLAT-01", "Operator platform with handrail 2×1.5 m", "fab", "nos", "7308", 18, 68500, "MS IS2062 E250"],
  ["STR-STAIR-01", "Staircase, 12 steps, chequered plate", "fab", "nos", "7308", 18, 54000, "MS IS2062 E250"],
  ["STR-SKID-01", "Pump skid base frame ISMC 150", "fab", "nos", "7308", 18, 38500, "MS IS2062 E250"],
  ["STR-RACK-01", "Pallet rack upright 3 m (pair)", "fab", "set", "7308", 18, 7200, "MS IS2062 E250"],
  ["GRD-MESH-01", "Machine guard mesh panel 1×1 m", "fab", "pcs", "7314", 18, 2350, "MS IS2062 E250"],
  ["SFT-EN8-40", "Drive shaft Ø40×600 EN8, keyway", "mach", "pcs", "8483", 18, 1850, "EN8"],
  ["SFT-EN19-55", "Drive shaft Ø55×900 EN19, hardened", "mach", "pcs", "8483", 18, 4600, "EN19"],
  ["FLG-SS304-100", "Flange 100 NB SS304 PN16", "mach", "pcs", "7307", 18, 1450, "SS 304"],
  ["FLG-MS-150", "Flange 150 NB MS slip-on", "mach", "pcs", "7307", 18, 980, "MS IS2062 E250"],
  ["BSH-BRZ-30", "Bronze bush Ø30/40×40", "mach", "pcs", "8483", 18, 420, "Bronze"],
  ["HUB-EN8-01", "Sprocket hub EN8 machined", "mach", "pcs", "8483", 18, 1250, "EN8"],
  ["PIN-EN19-20", "Hinge pin Ø20×120 EN19", "mach", "pcs", "7318", 18, 185, "EN19"],
  ["SPC-AL-01", "Aluminium spacer block 50×50×25", "mach", "pcs", "7616", 18, 260, "Aluminium 6061"],
  ["ENC-CRCA-01", "Electrical enclosure 600×400×200 CRCA", "sheet", "nos", "8538", 18, 5400, "CRCA sheet"],
  ["ENC-SS-01", "SS304 junction box 300×300×150", "sheet", "nos", "8538", 18, 3900, "SS 304"],
  ["CVR-GI-01", "Belt guard cover GI 1.2 mm", "sheet", "pcs", "7326", 18, 1150, "GI sheet"],
  ["TRY-SS-01", "SS304 tray 600×400×50", "sheet", "pcs", "7323", 18, 2100, "SS 304"],
  ["PNL-CRCA-02", "Control panel door 800×600", "sheet", "pcs", "8538", 18, 2650, "CRCA sheet"],
  ["DCT-GI-01", "Ducting section 300 Ø ×1 m GI", "sheet", "mtr", "7306", 18, 890, "GI sheet"],
  ["CNV-ROL-50", "Conveyor roller Ø50×500", "conv", "pcs", "8431", 18, 620, "MS IS2062 E250"],
  ["CNV-ROL-89", "Conveyor roller Ø89×800 heavy duty", "conv", "pcs", "8431", 18, 1480, "MS IS2062 E250"],
  ["CNV-FRM-3M", "Conveyor frame section 3 m", "conv", "nos", "8428", 18, 14500, "MS IS2062 E250"],
  ["CNV-IDL-01", "Troughing idler set 3-roll", "conv", "set", "8431", 18, 3850, "MS IS2062 E250"],
  ["CNV-PUL-01", "Drive pulley Ø300 lagged", "conv", "nos", "8483", 18, 18500, "MS IS2062 E250"],
  ["CNV-CHT-01", "Discharge chute with liner", "conv", "nos", "8431", 18, 22000, "MS IS2062 E250"],
  ["ASY-TRL-01", "Material handling trolley 500 kg", "assy", "nos", "8716", 18, 16500, "MS IS2062 E250"],
  ["ASY-HOP-01", "Hopper 1 m³ with slide gate", "assy", "nos", "8479", 18, 46000, "MS IS2062 E250"],
  ["ASY-TNK-SS", "SS304 storage tank 500 L", "assy", "nos", "7309", 18, 98000, "SS 304"],
  ["ASY-FIX-01", "Welding fixture for bracket assy", "assy", "nos", "8466", 18, 42000, "EN8"],
  ["ASY-JIG-01", "Drilling jig with bush plate", "assy", "nos", "8466", 18, 28500, "EN8"],
  ["SVC-LASER", "Laser cutting job work (per kg)", "svc", "kg", "9988", 18, 38, "MS IS2062 E250"],
  ["SVC-BEND", "CNC bending job work (per bend)", "svc", "nos", "9988", 18, 12, "MS IS2062 E250"],
  ["SVC-PAINT", "Powder coating (per sqm)", "svc", "sqm", "9988", 18, 165, "—"],
  ["SVC-WELD", "Welding labour (per hour)", "svc", "lot", "9988", 18, 650, "—"],
  ["SVC-MACH", "CNC machining (per hour)", "svc", "lot", "9988", 18, 1400, "—"],
  ["SVC-ERECT", "Site erection & commissioning", "svc", "lot", "9954", 18, 35000, "—"],
  ["SVC-DESIGN", "Design & 3D drawing (per drawing)", "svc", "nos", "9983", 18, 4500, "—"],
];

const MACHINES: [string, string, string, string][] = [
  ["CNC-01", "Haas VF-2 vertical machining centre", "cnc", "Bay A"],
  ["CNC-02", "Ace Micromatic VMC 550", "cnc", "Bay A"],
  ["LTH-01", "LMW Smarturn CNC lathe", "lathe", "Bay A"],
  ["LSR-01", "3 kW fibre laser 3015", "laser", "Bay B"],
  ["PBK-01", "Press brake 100 T × 3 m", "press", "Bay B"],
  ["WLD-01", "MIG welding bay 1", "weld", "Bay C"],
  ["WLD-02", "MIG/TIG welding bay 2", "weld", "Bay C"],
  ["PNT-01", "Powder coating booth & oven", "paint", "Bay D"],
  ["DRL-01", "Radial drill 50 mm", "drill", "Bay A"],
];

// fictional customers: name, industry, city, contact person, designation
const CUSTOMERS: [string, string, string, string, string][] = [
  ["Sahyadri Agro Implements Pvt Ltd", "Agricultural machinery", "Satara", "Prakash Jadhav", "Purchase Manager"],
  ["Deccan Conveyor Systems", "Material handling", "Pune", "Anil Kulkarni", "Director"],
  ["Indrayani Pumps & Valves", "Pumps", "Talegaon", "Sneha Patil", "Sr. Buyer"],
  ["Narmada Packaging Machines LLP", "Packaging machinery", "Ahmedabad", "Hardik Shah", "Projects Head"],
  ["Kaveri Food Processing Equipments", "Food processing", "Mysuru", "Ramesh Gowda", "Purchase Officer"],
  ["Vidarbha Cement Works Ltd", "Cement", "Chandrapur", "Sanjay Deshmukh", "Maintenance Manager"],
  ["Shivneri Auto Components", "Automotive", "Chakan", "Meera Joshi", "SCM Lead"],
  ["Ganga Pharma Machinery", "Pharma equipment", "Thane", "Vikram Mehta", "Purchase Manager"],
  ["Konkan Marine Engineering", "Marine", "Ratnagiri", "Faisal Khan", "Workshop Head"],
  ["Tapi Textile Machinery Works", "Textile machinery", "Surat", "Jignesh Patel", "Owner"],
  ["Malwa Agro Foods Pvt Ltd", "Food processing", "Indore", "Rohit Agrawal", "Plant Head"],
  ["Sinhagad Electricals", "Electrical panels", "Pune", "Swati Bhosale", "Production Manager"],
  ["Godavari Sugar Industries", "Sugar", "Ahmednagar", "Bhausaheb Shinde", "Chief Engineer"],
  ["Ajanta Plastics Moulders", "Plastics", "Aurangabad", "Nitin Rathod", "Maintenance In-charge"],
  ["Krishna Water Solutions", "Water treatment", "Kolhapur", "Pooja Kale", "Project Engineer"],
  ["Western Ghats Boilers", "Boilers", "Nashik", "Amit Pawar", "Purchase Head"],
  ["Bhima Steel Traders", "Steel trading", "Solapur", "Suresh Mane", "Partner"],
  ["Pune Robotics & Automation", "Automation", "Hinjewadi", "Kavya Iyer", "Design Lead"],
  ["Sahyog Infra Projects", "Construction", "Mumbai", "Rajesh Nair", "Site Manager"],
  ["Mula Chemicals Pvt Ltd", "Chemicals", "Kurkumbh", "Dinesh Wagh", "Engineering Manager"],
  ["Nilgiri Tea Machinery", "Tea processing", "Coimbatore", "Arun Kumar", "Purchase Manager"],
  ["Satpuda Forgings", "Forging", "Jalgaon", "Mahesh Chaudhari", "Plant Head"],
  ["Rajgad Elevators", "Elevators", "Pune", "Neha Kadam", "Buyer"],
  ["Ujani Dairy Cooperative", "Dairy", "Baramati", "Vijay Gaikwad", "Engineer"],
  ["Purandar Warehousing", "Logistics", "Wagholi", "Sameer Deshpande", "Operations Head"],
];

const SOURCES = ["phone", "email", "whatsapp", "visit", "referral", "tradeshow"];

async function main() {
  const org = await p.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No workspace. Run npm run db:seed first.");
  const T = org.id;

  await p.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, T);

    // ── wipe business data (keep users/roles/settings) ──
    await tx.attachment.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.jobUpdate.deleteMany({});
    await tx.productionJob.deleteMany({});
    await tx.orderStatusHistory.deleteMany({});
    await tx.order.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.quoteRevision.deleteMany({});
    await tx.quote.deleteMany({});
    await tx.task.deleteMany({});
    await tx.activity.deleteMany({});
    await tx.note.deleteMany({});
    await tx.stageHistory.deleteMany({});
    await tx.lead.deleteMany({});
    await tx.contact.deleteMany({});
    await tx.account.deleteMany({});
    await tx.product.deleteMany({});
    await tx.machine.deleteMany({});
    await tx.masterValue.deleteMany({});
    await tx.auditLog.deleteMany({});

    // ── masters ──
    for (const [kind, rows] of Object.entries(LISTS))
      await tx.masterValue.createMany({ data: rows.map(([value, label, def], i) => ({ tenantId: T, kind, value, label, isDefault: !!def, orderIndex: i })) });
    await tx.product.createMany({
      data: PRODUCTS.map(([code, name, category, unit, hsnCode, gst, price, material]) => ({
        tenantId: T, code, name, category, unit, hsnCode, gstRate: D(gst), price: D(price), material: material === "—" ? null : material,
      })),
    });
    await tx.machine.createMany({ data: MACHINES.map(([code, name, type, location]) => ({ tenantId: T, code, name, type, location })) });
    const machines = await tx.machine.findMany();

    // ── team ──
    const roles = Object.fromEntries((await tx.role.findMany()).map((r) => [r.name, r.id]));
    const hash = await bcrypt.hash("password123", 10);
    const team: [string, string, "manager" | "agent"][] = [
      ["priya.sales@acme.test", "Priya Kulkarni", "manager"],
      ["rahul.sales@acme.test", "Rahul Deshpande", "agent"],
      ["santosh.prod@acme.test", "Santosh Pawar", "manager"],
      ["operator@acme.test", "Ravi Operator", "agent"],
      ["imran.op@acme.test", "Imran Shaikh", "agent"],
      ["ganesh.op@acme.test", "Ganesh More", "agent"],
    ];
    for (const [email, fullName, role] of team)
      await tx.user.upsert({
        where: { tenantId_email: { tenantId: T, email } },
        update: { fullName },
        create: { tenantId: T, email, fullName, passwordHash: hash, role, roleId: roles[role] },
      });
    const users = await tx.user.findMany();
    const U = (email: string) => users.find((u) => u.email === email)!.id;
    const sales = [U("admin@acme.test"), U("priya.sales@acme.test"), U("rahul.sales@acme.test")];
    const operators = [U("operator@acme.test"), U("imran.op@acme.test"), U("ganesh.op@acme.test")];
    const prodMgr = U("santosh.prod@acme.test");

    // ── customers & contacts ──
    const accounts: { id: string; name: string; contactId: string; owner: string }[] = [];
    for (const [i, [name, industry, city, person, designation]] of CUSTOMERS.entries()) {
      const owner = sales[i % sales.length];
      const createdAt = daysAgo(int(150, 200));
      const slug = name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 14);
      const acc = await tx.account.create({
        data: {
          tenantId: T, name, industry, ownerId: owner, createdAt,
          domain: `${slug}.example.in`, website: `https://${slug}.example.in`,
          phone: `+91 9${int(100000000, 999999999)}`,
          customValues: { city },
        },
      });
      const first = person.split(" ")[0].toLowerCase();
      const c = await tx.contact.create({
        data: {
          tenantId: T, fullName: person, email: `${first}@${slug}.example.in`, phone: `+91 9${int(100000000, 999999999)}`,
          accountId: acc.id, ownerId: owner, createdAt, customValues: { designation },
        },
      });
      accounts.push({ id: acc.id, name, contactId: c.id, owner });
    }

    // ── stages ──
    const stages = await tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } });
    const S = (n: string) => stages.find((s) => s.name === n)!;
    const pipelineId = stages[0].pipelineId;

    let qn = 0, on = 0, jn = 0, inv = 0;
    const products = await tx.product.findMany();
    const goods = products.filter((x) => x.category !== "svc");

    // ── 70 enquiries over 180 days, each walked through the funnel ──
    for (let i = 0; i < 70; i++) {
      const acc = pick(accounts);
      const age = int(2, 180);
      const created = daysAgo(age);
      const lineCount = int(1, 3);
      const lines = Array.from({ length: lineCount }, () => {
        const pr = pick(goods);
        const price = Number(pr.price);
        const qty = price > 20000 ? int(1, 4) : price > 2000 ? int(5, 40) : round(int(50, 1500), 10);
        return { pr, qty, price: round(price * (0.95 + rnd() * 0.15), price > 100 ? 5 : 1) };
      });
      const value = lines.reduce((s, l) => s + l.qty * l.price, 0);
      const main = lines[0];

      // where did it end up? older enquiries are further along
      const r = rnd();
      const outcome = age < 7 ? (r < 0.6 ? "new" : "qualified")
        : age < 20 ? (r < 0.25 ? "qualified" : r < 0.7 ? "quoted" : r < 0.85 ? "negotiation" : "won")
        : r < 0.12 ? "lost_early" : r < 0.42 ? "lost" : r < 0.5 ? "quoted" : "won";
      const stageName = { new: "New enquiry", qualified: "Qualified", quoted: "Quoted", negotiation: "Negotiation", won: "Won", lost: "Lost", lost_early: "Lost" }[outcome]!;

      const lead = await tx.lead.create({
        data: {
          tenantId: T, pipelineId, stageId: S(stageName).id, ownerId: acc.owner, currency: "INR",
          title: `${acc.name.split(" ").slice(0, 2).join(" ")} – ${main.qty} ${main.pr.unit} ${main.pr.name.split(",")[0]}`,
          source: pick(SOURCES), estimatedValue: Math.round(value), createdAt: created, lastActivityAt: created,
          // last touched when the enquiry was closed or last worked on, not today
          updatedAt: new Date(Math.min(NOW - 3600_000, created.getTime() + (outcome === "new" ? 0 : int(4, 20)) * DAY)),
          customValues: {
            product_required: main.pr.name, quantity: main.qty, material: main.pr.material ?? "",
            required_by: new Date(created.getTime() + int(20, 60) * DAY).toISOString().slice(0, 10),
            drawing_ref: rnd() < 0.6 ? `DRG-${int(1000, 9999)} Rev ${pick(["A", "B", "C"])}` : "",
            enquiry_source: pick(SOURCES),
          },
        },
      });
      await tx.activity.create({ data: { tenantId: T, leadId: lead.id, type: pick(["call", "email", "meeting"] as const), title: "Enquiry received", body: `Customer asked for ${main.qty} ${main.pr.unit} ${main.pr.name}.`, createdById: acc.owner, createdAt: created } });
      if (outcome === "new") continue;
      await tx.stageHistory.create({ data: { tenantId: T, leadId: lead.id, fromStageId: S("New enquiry").id, toStageId: S("Qualified").id, changedById: acc.owner, changedAt: new Date(created.getTime() + DAY) } }).catch(() => {});
      if (outcome === "qualified" || outcome === "lost_early") continue;

      // quotation
      qn++;
      const qDate = new Date(created.getTime() + int(1, 4) * DAY);
      const items = lines.map((l, k) => {
        const disc = rnd() < 0.3 ? 5 : 0;
        const base = l.qty * l.price;
        const after = base * (1 - disc / 100);
        return { description: `${l.pr.name} (${l.pr.code})`, quantity: D(l.qty), unitPrice: D(l.price), discount: D(disc), taxRate: D(Number(l.pr.gstRate)), amount: D(after * (1 + Number(l.pr.gstRate) / 100)), orderIndex: k, _base: base, _after: after };
      });
      const subtotal = items.reduce((s, x) => s + x._base, 0);
      const afterDisc = items.reduce((s, x) => s + x._after, 0);
      const total = items.reduce((s, x) => s + Number(x.amount), 0);
      const qStatus = outcome === "won" ? (rnd() < 0.3 ? "invoiced" : "accepted") : outcome === "lost" ? pick(["rejected", "expired"] as const) : outcome === "quoted" ? "sent" : "sent";
      const revised = outcome === "negotiation" || (outcome === "won" && rnd() < 0.35);
      const quote = await tx.quote.create({
        data: {
          tenantId: T, number: `QUO-${String(qn).padStart(4, "0")}`, status: qStatus, revision: revised ? 2 : 1,
          accountId: acc.id, contactId: acc.contactId, leadId: lead.id, ownerId: acc.owner,
          issueDate: qDate, expiryDate: new Date(qDate.getTime() + 30 * DAY), currency: "INR",
          subtotal: D(subtotal), discountAmt: D(subtotal - afterDisc), taxAmt: D(total - afterDisc), total: D(total),
          terms: pick(LISTS.payment_term)[1] + ". " + LISTS.delivery_term[0][1] + ". Validity 30 days.",
          createdAt: qDate,
          items: { create: items.map(({ _base, _after, ...x }) => (void _base, void _after, x)) },
        },
      });
      if (revised) {
        await tx.quoteRevision.create({
          data: {
            tenantId: T, quoteId: quote.id, revision: 1, total: D(total * 1.06), reason: pick(["Customer asked for a better price", "Quantity changed", "Material changed to SS304", "Delivery schedule revised"]),
            createdById: acc.owner, createdAt: new Date(qDate.getTime() + 3 * DAY),
            snapshot: { currency: "INR", items: items.map((x) => ({ description: x.description, quantity: String(x.quantity), unitPrice: String(Number(x.unitPrice) * 1.06), amount: String(Number(x.amount) * 1.06) })) },
          },
        });
      }
      await tx.activity.create({ data: { tenantId: T, leadId: lead.id, type: "email", title: `Quotation ${quote.number} sent`, createdById: acc.owner, createdAt: qDate } });
      if (outcome !== "won") continue;

      // order
      on++;
      const oDate = new Date(qDate.getTime() + int(3, 12) * DAY);
      const leadTime = int(18, 45);
      const due = new Date(oDate.getTime() + leadTime * DAY);
      const daysSinceOrder = (NOW - oDate.getTime()) / DAY;
      // progress depends on how long ago the order came in
      const progress = daysSinceOrder > leadTime + 10 ? "closed" : daysSinceOrder > leadTime ? pick(["dispatched", "closed", "ready"]) : daysSinceOrder > leadTime * 0.6 ? pick(["in_production", "ready", "in_production"]) : daysSinceOrder > 3 ? "in_production" : "confirmed";
      const late = rnd() < 0.2;
      const dispatchedAt = ["dispatched", "closed"].includes(progress) ? new Date(due.getTime() + (late ? int(2, 9) : -int(0, 4)) * DAY) : null;
      const order = await tx.order.create({
        data: {
          tenantId: T, number: `ORD-${String(on).padStart(4, "0")}`, status: progress as never, quoteId: quote.id, accountId: acc.id, contactId: acc.contactId, ownerId: acc.owner,
          orderDate: oDate, dueDate: due, dispatchedAt, poReference: `PO/${new Date(oDate).getFullYear()}/${int(1000, 9999)}`, currency: "INR", total: D(total),
          createdAt: oDate,
          items: { create: lines.map((l, k) => ({ description: `${l.pr.name} (${l.pr.code})`, quantity: D(l.qty), unit: l.pr.unit, unitPrice: D(l.price), amount: D(l.qty * l.price), orderIndex: k })) },
        },
      });
      const path = ["confirmed", "in_production", "ready", "dispatched", "closed"];
      const reached = path.slice(0, path.indexOf(progress) + 1);
      let prev: string | null = null;
      for (const [k, st] of reached.entries()) {
        const at = st === "dispatched" && dispatchedAt ? dispatchedAt : st === "closed" && dispatchedAt ? new Date(dispatchedAt.getTime() + 2 * DAY) : new Date(oDate.getTime() + k * (leadTime / 4) * DAY);
        await tx.orderStatusHistory.create({ data: { tenantId: T, orderId: order.id, fromStatus: prev as never, toStatus: st as never, note: k === 0 ? `Converted from ${quote.number}` : null, changedById: st === "in_production" || st === "ready" ? prodMgr : acc.owner, changedAt: at } });
        prev = st;
      }

      // production jobs, one per line
      if (progress !== "confirmed") {
        for (const l of lines) {
          jn++;
          const jobDone = ["ready", "dispatched", "closed"].includes(progress);
          const stage = jobDone ? "completed" : pick(["in_progress", "in_progress", "planned", "quality_check", "paused"] as const);
          const target = l.qty;
          const out = stage === "completed" ? target : stage === "planned" ? 0 : Math.floor(target * (0.2 + rnd() * 0.7));
          const rej = out ? Math.floor(out * rnd() * 0.04) : 0;
          const machine = pick(machines.filter((m) => (l.pr.category === "mach" ? ["cnc", "lathe", "drill"] : l.pr.category === "sheet" ? ["laser", "press"] : ["weld", "laser"]).includes(m.type ?? "")));
          const start = new Date(oDate.getTime() + int(1, 3) * DAY);
          const completedAt = stage === "completed" ? new Date((dispatchedAt ?? new Date(due.getTime() - 2 * DAY)).getTime() - int(1, 3) * DAY) : null;
          const op = pick(operators);
          const job = await tx.productionJob.create({
            data: {
              tenantId: T, number: `JOB-${String(jn).padStart(4, "0")}`, title: l.pr.name, orderId: order.id, stage, priority: late ? "high" : pick(["medium", "medium", "low", "high"] as const),
              assigneeId: op, machineId: machine?.id, targetQty: D(target), outputQty: D(out), rejectQty: D(rej), unit: l.pr.unit,
              startDate: stage === "planned" ? null : start, dueDate: new Date(due.getTime() - 2 * DAY), completedAt,
              specification: `As per drawing. ${l.pr.material ? `Material ${l.pr.material}.` : ""} Deburr all edges.`,
              materialNotes: l.pr.material ? `${l.pr.material} – issue from stores against ${order.number}` : null,
              createdAt: start,
            },
          });
          await tx.jobUpdate.create({ data: { tenantId: T, jobId: job.id, toStage: "planned", note: `Planned from ${order.number}`, createdById: prodMgr, createdAt: start } });
          if (stage !== "planned") {
            await tx.jobUpdate.create({ data: { tenantId: T, jobId: job.id, fromStage: "planned", toStage: "in_progress", createdById: op, createdAt: new Date(start.getTime() + DAY) } });
            // output in 1–4 shifts
            const shifts = out ? int(1, 4) : 0;
            let left = out, leftRej = rej;
            for (let s = 0; s < shifts; s++) {
              const g = s === shifts - 1 ? left : Math.floor(left / (shifts - s));
              const rj = s === shifts - 1 ? leftRej : Math.floor(leftRej / (shifts - s));
              left -= g; leftRej -= rj;
              const at = new Date(Math.min(NOW - 3600_000, start.getTime() + (s + 2) * DAY));
              await tx.jobUpdate.create({ data: { tenantId: T, jobId: job.id, outputDelta: D(g), rejectDelta: D(rj), note: pick(["Shift A", "Shift B", "Shift A – night", "Shift B"]) + (rj ? " · dimension out of tolerance" : ""), createdById: op, createdAt: at } });
            }
          }
          if (stage === "completed" && completedAt)
            await tx.jobUpdate.create({ data: { tenantId: T, jobId: job.id, fromStage: "quality_check", toStage: "completed", note: "QC passed", createdById: prodMgr, createdAt: completedAt } });
        }
      }

      // invoice once dispatched
      if (dispatchedAt) {
        inv++;
        const paid = (NOW - dispatchedAt.getTime()) / DAY > 30 ? rnd() < 0.85 : rnd() < 0.3;
        const dueDate = new Date(dispatchedAt.getTime() + 30 * DAY);
        await tx.invoice.create({
          data: {
            tenantId: T, number: `INV-${String(inv).padStart(4, "0")}`, type: "invoice",
            status: paid ? "paid" : dueDate.getTime() < NOW ? "overdue" : "sent",
            quoteId: quote.id, accountId: acc.id, contactId: acc.contactId, ownerId: acc.owner,
            issueDate: dispatchedAt, dueDate, currency: "INR",
            subtotal: D(subtotal), discountAmt: D(subtotal - afterDisc), taxAmt: D(total - afterDisc), total: D(total),
            amountPaid: D(paid ? total : 0), createdAt: dispatchedAt,
            items: { create: items.map(({ _base, _after, ...x }) => (void _base, void _after, x)) },
          },
        });
      }
    }

    // ── a few follow-up tasks ──
    const openLeads = await tx.lead.findMany({ where: { stage: { isTerminal: false } }, take: 12, orderBy: { createdAt: "desc" } });
    for (const [i, l] of openLeads.entries()) {
      const ecd = new Date(NOW + (i % 3 === 0 ? -int(1, 4) : int(1, 7)) * DAY);
      await tx.task.create({
        data: {
          tenantId: T, leadId: l.id, item: pick(["Follow up on quotation", "Share revised drawing", "Confirm material grade", "Arrange plant visit", "Send compliance documents"]),
          priority: pick(["medium", "high", "low"] as const), status: "open", ecd, assigneeId: l.ownerId, createdById: l.ownerId ?? sales[0],
        },
      }).catch(() => {});
    }

    console.log(`Demo data for ${org.name}: ${CUSTOMERS.length} customers, ${PRODUCTS.length} items, ${MACHINES.length} machines, 70 enquiries, ${qn} quotations, ${on} orders, ${jn} jobs, ${inv} invoices.`);
  }, { timeout: 600_000, maxWait: 60_000 });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
