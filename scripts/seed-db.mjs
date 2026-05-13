/**
 * Builds a minimal Qatari Law SQLite database following the @ansvar/qatari-law-mcp schema.
 * Run once: node scripts/seed-db.mjs
 */
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = resolve(__dirname, "../node_modules/@ansvar/qatari-law-mcp/dist/data");
const DB_PATH = resolve(DB_DIR, "database.db");

mkdirSync(DB_DIR, { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS legal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('statute','bill','case_law')),
  title TEXT NOT NULL,
  title_en TEXT,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK(status IN ('in_force','amended','repealed','not_yet_in_force')),
  issued_date TEXT,
  in_force_date TEXT,
  url TEXT,
  description TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS legal_provisions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_ref TEXT NOT NULL,
  chapter TEXT,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  UNIQUE(document_id, provision_ref)
);

CREATE INDEX IF NOT EXISTS idx_provisions_doc ON legal_provisions(document_id);
CREATE INDEX IF NOT EXISTS idx_provisions_chapter ON legal_provisions(document_id, chapter);

CREATE VIRTUAL TABLE IF NOT EXISTS provisions_fts USING fts5(
  content, title,
  content='legal_provisions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS provisions_ai AFTER INSERT ON legal_provisions BEGIN
  INSERT INTO provisions_fts(rowid, content, title) VALUES (new.id, new.content, new.title);
END;

CREATE TRIGGER IF NOT EXISTS provisions_ad AFTER DELETE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title) VALUES('delete', old.id, old.content, old.title);
END;

CREATE TRIGGER IF NOT EXISTS provisions_au AFTER UPDATE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title) VALUES('delete', old.id, old.content, old.title);
  INSERT INTO provisions_fts(rowid, content, title) VALUES (new.id, new.content, new.title);
END;
`);

const insertDoc = db.prepare(`
  INSERT OR IGNORE INTO legal_documents
    (id, type, title, title_en, short_name, status, issued_date, in_force_date, url, description)
  VALUES (@id, @type, @title, @title_en, @short_name, @status, @issued_date, @in_force_date, @url, @description)
`);

const insertProv = db.prepare(`
  INSERT OR IGNORE INTO legal_provisions
    (document_id, provision_ref, chapter, section, title, content, metadata)
  VALUES (@document_id, @provision_ref, @chapter, @section, @title, @content, @metadata)
`);

const seed = db.transaction((docs) => {
  for (const doc of docs) {
    insertDoc.run({
      id: doc.id,
      type: doc.type ?? "statute",
      title: doc.title,
      title_en: doc.title_en ?? doc.title,
      short_name: doc.short_name,
      status: doc.status ?? "in_force",
      issued_date: doc.issued_date ?? null,
      in_force_date: doc.in_force_date ?? null,
      url: doc.url ?? null,
      description: doc.description ?? null,
    });
    for (const prov of doc.provisions ?? []) {
      insertProv.run({
        document_id: doc.id,
        provision_ref: prov.ref,
        chapter: prov.chapter ?? null,
        section: prov.section,
        title: prov.title ?? null,
        content: prov.content,
        metadata: prov.metadata ? JSON.stringify(prov.metadata) : null,
      });
    }
  }
});

// ─── Seed Data ───────────────────────────────────────────────────────────────

seed([
  // ── Labour Law No. 14 of 2004 ──────────────────────────────────────────────
  {
    id: "qa-labour-law-14-2004",
    title: "قانون العمل رقم (14) لسنة 2004",
    title_en: "Labour Law No. 14 of 2004",
    short_name: "Labour Law 14/2004",
    issued_date: "2004-01-01",
    in_force_date: "2004-01-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=3961",
    description: "The primary labour law governing employment relationships in Qatar, including contracts, wages, working hours, leave, termination, and end-of-service benefits.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – Definitions",
        title: "Definitions",
        content: "In the application of the provisions of this Law, the following words and expressions shall have the meanings assigned to them unless the context otherwise requires: Employer: every natural or juridical person who employs one or more workers for a wage. Worker: every natural person who performs manual or intellectual work for an employer and under his management or supervision for a wage."
      },
      {
        ref: "Art.3", section: "Art.3", chapter: "Chapter 1 – Definitions",
        title: "Scope of Application",
        content: "The provisions of this Law shall apply to all workers and employers in Qatar except: (1) Government employees and employees of government bodies. (2) Members of the armed forces, police and security. (3) Domestic workers employed at private homes. (4) Agricultural workers."
      },
      {
        ref: "Art.38", section: "Art.38", chapter: "Chapter 5 – Employment Contract",
        title: "Employment Contract – Form",
        content: "The employment contract shall be in writing, in Arabic and in another language if the worker does not understand Arabic. If the contract is not in writing, the worker may prove its existence by all means of proof. The employer shall provide each worker with a copy of the contract."
      },
      {
        ref: "Art.46", section: "Art.46", chapter: "Chapter 6 – Wages",
        title: "Wage Payment",
        content: "The employer shall pay the worker his wage not later than seven days after the end of the period for which the wage was agreed to be paid. In the case of monthly wages, payment shall be made at the end of each month."
      },
      {
        ref: "Art.52", section: "Art.52", chapter: "Chapter 6 – Wages",
        title: "Minimum Wage",
        content: "The Council of Ministers shall issue a decision setting the minimum wage for workers. The minimum wage shall take into consideration the economic conditions in the State and the need to ensure a decent living standard for workers. The minimum basic wage for workers in Qatar is QAR 1,000 per month, with a food allowance of QAR 300 and housing allowance of QAR 500 where the employer does not provide food and accommodation (as amended by Law 17/2020)."
      },
      {
        ref: "Art.72", section: "Art.72", chapter: "Chapter 8 – Working Hours and Rest",
        title: "Working Hours",
        content: "The normal working hours for adult workers shall not exceed 8 hours per day or 48 hours per week. During the month of Ramadan, working hours for Muslim workers shall be reduced to 6 hours per day or 36 hours per week."
      },
      {
        ref: "Art.80", section: "Art.80", chapter: "Chapter 9 – Annual Leave",
        title: "Annual Leave",
        content: "A worker who has completed one year of service shall be entitled to annual leave with full wage for a period of not less than three weeks. After five years of service, the annual leave shall be extended to not less than four weeks. Annual leave is calculated on the basis of the complete year of service."
      },
      {
        ref: "Art.116", section: "Art.116", chapter: "Chapter 15 – Termination of Contract",
        title: "Termination Notice",
        content: "Either party may terminate an indefinite-term employment contract by giving written notice to the other party. The notice period shall be not less than one month if the worker has been employed for less than two years, and not less than two months if the worker has been employed for two or more years."
      },
      {
        ref: "Art.119", section: "Art.119", chapter: "Chapter 15 – Termination of Contract",
        title: "Arbitrary Dismissal",
        content: "If the dismissal of a worker is found to be arbitrary, the court may award the worker compensation in addition to the end-of-service gratuity. The compensation shall be assessed by the court taking into account the nature of the work, the duration of service, and the circumstances of the dismissal. Compensation shall not exceed one year's wage."
      },
      {
        ref: "Art.54", section: "Art.54", chapter: "Chapter 16 – End of Service Gratuity",
        title: "End of Service Gratuity",
        content: "At the end of the service of a worker who has completed one year or more in the service of an employer, the employer shall pay the worker an end-of-service gratuity for the period of service calculated on the basis of a three-week wage for each year of service. The last wage received by the worker shall be the basis for the calculation of the gratuity."
      },
    ]
  },

  // ── Commercial Companies Law No. 11 of 2015 ─────────────────────────────────
  {
    id: "qa-companies-law-11-2015",
    title: "قانون الشركات التجارية رقم (11) لسنة 2015",
    title_en: "Commercial Companies Law No. 11 of 2015",
    short_name: "Companies Law 11/2015",
    issued_date: "2015-01-01",
    in_force_date: "2016-01-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=6645",
    description: "The primary law governing the establishment and operation of commercial companies in Qatar, including limited liability companies, joint-stock companies, and foreign branches.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Part 1 – General Provisions",
        title: "Definitions",
        content: "Company: a contract by which two or more persons undertake to participate in a profit-making enterprise by contributing a share of capital or labour, with a view to dividing any profits or losses resulting therefrom."
      },
      {
        ref: "Art.8", section: "Art.8", chapter: "Part 1 – General Provisions",
        title: "Commercial Registry",
        content: "Every company shall be registered in the Commercial Registry before commencing its activities. Registration in the Commercial Registry shall be a condition for the company acquiring legal personality. The company shall be deemed to have acquired legal personality from the date of its registration."
      },
      {
        ref: "Art.231", section: "Art.231", chapter: "Part 5 – Limited Liability Companies",
        title: "LLC – Formation",
        content: "A limited liability company is a company consisting of a number of partners not less than two and not more than fifty. Each partner shall be liable only to the extent of his share in the capital. The name of the company shall be derived from the subject of its business or from the name of one or more of the partners."
      },
      {
        ref: "Art.234", section: "Art.234", chapter: "Part 5 – Limited Liability Companies",
        title: "LLC – Minimum Capital",
        content: "The minimum share capital of a limited liability company shall be two hundred thousand Qatari Riyals (QAR 200,000). The capital shall be divided into equal shares, the nominal value of each share shall not be less than one hundred Qatari Riyals (QAR 100). The capital shall be fully paid upon incorporation."
      },
      {
        ref: "Art.269", section: "Art.269", chapter: "Part 5 – Foreign Ownership",
        title: "Foreign Ownership – General Rule",
        content: "Subject to the provisions of the Investment Promotion Law (Law No. 1 of 2019), non-Qatari partners in a limited liability company may hold up to 100% of the share capital, subject to approval by the Ministry of Commerce and Industry, unless the activity falls within a restricted sector."
      },
      {
        ref: "Art.303", section: "Art.303", chapter: "Part 7 – Foreign Branches",
        title: "Foreign Company Branches",
        content: "A foreign company may open a branch in Qatar upon obtaining a licence from the Ministry of Commerce and Industry. The branch shall be subject to all Qatari laws and regulations. The foreign company shall appoint a Qatari agent for the purposes of the branch, unless it is exempted pursuant to law."
      },
    ]
  },

  // ── Investment Promotion Law No. 1 of 2019 ──────────────────────────────────
  {
    id: "qa-investment-law-1-2019",
    title: "قانون تشجيع الاستثمار رقم (1) لسنة 2019",
    title_en: "Investment Promotion Law No. 1 of 2019",
    short_name: "Investment Law 1/2019",
    issued_date: "2019-01-01",
    in_force_date: "2019-06-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=8237",
    description: "Regulates foreign investment in Qatar, permitting up to 100% foreign ownership in most sectors with exceptions listed in the Annex.",
    provisions: [
      {
        ref: "Art.3", section: "Art.3", chapter: "Chapter 1 – Investment",
        title: "Foreign Ownership – 100%",
        content: "Non-Qatari investors may own up to 100% of the capital of investment projects in all economic sectors, with the exception of the sectors and activities listed in the schedule attached to this Law. The Minister of Commerce and Industry may issue decisions to amend the list of restricted sectors."
      },
      {
        ref: "Art.4", section: "Art.4", chapter: "Chapter 1 – Incentives",
        title: "Investment Incentives",
        content: "Investment projects may be granted incentives and exemptions, including: (1) Exemption from income tax for a period not exceeding ten years, renewable. (2) Exemption from customs duties on imported equipment, machinery, and raw materials. (3) The right to transfer capital and profits abroad. (4) Equal treatment with national investors in legal proceedings."
      },
      {
        ref: "Annex", section: "Annex", chapter: "Restricted Sectors",
        title: "Restricted Sectors – Partial or Full Restrictions",
        content: "The following sectors are restricted from 100% foreign ownership under the Investment Promotion Law and related Ministerial Decisions: (1) Commercial agencies and brokerage. (2) Real estate (except in designated investment zones per Law 16/2018). (3) Recruitment agencies. (4) Financial services and banking (subject to Qatar Central Bank regulations). (5) Media and publishing activities. (6) Sports clubs and agencies. (7) Military and security supply."
      },
    ]
  },

  // ── Civil Code Law No. 22 of 2004 ──────────────────────────────────────────
  {
    id: "qa-civil-code-22-2004",
    title: "القانون المدني رقم (22) لسنة 2004",
    title_en: "Civil Code Law No. 22 of 2004",
    short_name: "Civil Code 22/2004",
    issued_date: "2004-01-01",
    in_force_date: "2004-08-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=3980",
    description: "Qatar's Civil Code governing contracts, obligations, property rights, and civil liability.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – Sources of Law",
        title: "Sources of Qatari Law",
        content: "The provisions of legislation shall apply to all matters to which these provisions relate in letter or spirit. In the absence of a legislative provision, the judge shall decide according to the principles of the Islamic Sharia, then by custom, then by the principles of natural law and the rules of equity."
      },
      {
        ref: "Art.64", section: "Art.64", chapter: "Chapter 3 – Contracts",
        title: "Contract Formation",
        content: "A contract is concluded when an offer and an acceptance have been exchanged between the two parties. A contract shall be binding on both parties and shall not be rescinded or amended except by mutual consent of both parties or for reasons permitted by law."
      },
      {
        ref: "Art.171", section: "Art.171", chapter: "Chapter 3 – Contracts",
        title: "Binding Force of Contract",
        content: "The contract is the law of the parties. It may not be revoked or amended except by mutual consent of the parties, or for reasons provided for in the law. The contract must be performed in a manner consistent with the requirements of good faith."
      },
      {
        ref: "Art.199", section: "Art.199", chapter: "Chapter 4 – Liability",
        title: "Liability for Damages",
        content: "Any act that causes damage to another obliges the person responsible for that act to provide compensation. Compensation shall cover actual loss and lost profit, provided these are a natural consequence of the wrongful act. Moral damages may also be compensated."
      },
    ]
  },

  // ── Real Estate Ownership Law No. 16 of 2018 ───────────────────────────────
  {
    id: "qa-realestate-ownership-16-2018",
    title: "قانون تملك غير القطريين للعقارات رقم (16) لسنة 2018",
    title_en: "Law on Non-Qatari Ownership of Real Estate No. 16 of 2018",
    short_name: "Real Estate Ownership Law 16/2018",
    issued_date: "2018-01-01",
    in_force_date: "2018-09-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=7988",
    description: "Regulates the ownership of real estate by non-Qatari nationals, designating specific zones where foreigners may acquire full ownership or usufruct rights.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – Ownership Rights",
        title: "Categories of Ownership",
        content: "Non-Qatari nationals may own real estate in Qatar in one of the following forms: (1) Full ownership (freehold) in zones designated by Emiri Decree. (2) Usufruct rights (long-term lease) for up to 99 years in additional designated zones. (3) Through a company in which a Qatari national holds no less than 51% of the capital, outside designated zones, for commercial purposes only."
      },
      {
        ref: "Art.3", section: "Art.3", chapter: "Chapter 1 – Designated Zones",
        title: "Freehold Zones",
        content: "Non-Qatari nationals may acquire full ownership in the following zones (freehold): The Pearl-Qatar, West Bay Lagoon, Al Khor Resort, Al Qassar, Qetaifan Islands (North and South), Lusail City, Viva Bahriya, Al Dafna, Onaiza, Al Mansoura and Fereej Bin Mahmoud, Al Duhail, Al Messila, Mohamed Bin Jassim, Al Kharayej, Jabal Theya, Lebaib, Al Sailiya, and Al Sharq."
      },
      {
        ref: "Art.5", section: "Art.5", chapter: "Chapter 2 – Rights",
        title: "Rights Conferred by Ownership",
        content: "Non-Qatari real estate owners and usufruct holders, together with their first-degree relatives, shall have the right to obtain residence permits for the duration of their ownership or usufruct, provided the value of the property is not less than QAR 730,000. Owners of properties valued at QAR 3,650,000 or more may be entitled to a permanent residency permit."
      },
    ]
  },

  // ── Penal Code Law No. 11 of 2004 ─────────────────────────────────────────
  {
    id: "qa-penal-code-11-2004",
    title: "قانون العقوبات رقم (11) لسنة 2004",
    title_en: "Penal Code Law No. 11 of 2004",
    short_name: "Penal Code 11/2004",
    issued_date: "2004-01-01",
    in_force_date: "2004-09-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=3969",
    description: "Qatar's Penal Code establishing criminal offences and penalties.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – General Provisions",
        title: "Legality Principle",
        content: "No act shall be considered a crime or punished except pursuant to a law in force at the time it is committed. No punishment shall be imposed other than that prescribed in such law."
      },
      {
        ref: "Art.315", section: "Art.315", chapter: "Chapter 10 – Offences Against Property",
        title: "Theft",
        content: "Any person who steals movable property belonging to another shall be punished with imprisonment for a period not exceeding three years and a fine not exceeding ten thousand Riyals, or either of these punishments."
      },
      {
        ref: "Art.335", section: "Art.335", chapter: "Chapter 10 – Fraud",
        title: "Fraud",
        content: "Any person who, with intent to defraud, obtains for himself or another a movable property, a deed, or a document by means of false pretence or fraudulent acts, shall be punished with imprisonment for a period not exceeding three years and a fine not exceeding thirty thousand Riyals."
      },
    ]
  },

  // ── Data Protection Law No. 13 of 2016 ───────────────────────────────────
  {
    id: "qa-pdp-law-13-2016",
    title: "قانون حماية البيانات الشخصية رقم (13) لسنة 2016",
    title_en: "Personal Data Privacy Protection Law No. 13 of 2016",
    short_name: "Data Protection Law 13/2016",
    issued_date: "2016-01-01",
    in_force_date: "2017-01-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=7082",
    description: "Qatar's primary personal data protection law, regulating the collection, processing, storage, and transfer of personal data.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – Definitions",
        title: "Definitions",
        content: "Personal Data: any data relating to an identified or identifiable natural person. Data Controller: any natural or legal person who determines the purposes and means of processing of personal data. Data Processor: any natural or legal person who processes personal data on behalf of the data controller. Data Subject: the natural person to whom the personal data relates."
      },
      {
        ref: "Art.5", section: "Art.5", chapter: "Chapter 2 – Processing Conditions",
        title: "Lawful Basis for Processing",
        content: "The processing of personal data shall be lawful only if: (1) The data subject has given his consent. (2) Processing is necessary for the performance of a contract to which the data subject is a party. (3) Processing is necessary to comply with a legal obligation. (4) Processing is necessary to protect the vital interests of the data subject. (5) Processing is carried out in the public interest."
      },
      {
        ref: "Art.14", section: "Art.14", chapter: "Chapter 4 – Transfer of Data",
        title: "Cross-Border Data Transfer",
        content: "Personal data may not be transferred outside Qatar to another country unless that country provides an adequate level of protection for personal data, or the transfer is made with the consent of the data subject, or the transfer is necessary for the performance of a contract."
      },
      {
        ref: "Art.20", section: "Art.20", chapter: "Chapter 5 – Penalties",
        title: "Penalties",
        content: "Any person who violates the provisions of this Law shall be punished with imprisonment for a period not exceeding one year and a fine of not less than ten thousand Riyals and not exceeding one hundred thousand Riyals, or either of these punishments. In the event of recidivism, both penalties shall be applied."
      },
    ]
  },

  // ── Cybercrime Law No. 14 of 2014 ─────────────────────────────────────────
  {
    id: "qa-cybercrime-law-14-2014",
    title: "قانون مكافحة الجرائم الإلكترونية رقم (14) لسنة 2014",
    title_en: "Cybercrime Prevention Law No. 14 of 2014",
    short_name: "Cybercrime Law 14/2014",
    issued_date: "2014-01-01",
    in_force_date: "2014-09-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=5721",
    description: "Qatar's law on combating cybercrime, covering unauthorised access, data interference, electronic fraud, and online content offences.",
    provisions: [
      {
        ref: "Art.5", section: "Art.5", chapter: "Chapter 1 – Offences",
        title: "Unauthorised Access",
        content: "Any person who intentionally accesses, without authorisation or in excess of authorisation, a computer system or information network shall be punished with imprisonment for a period not exceeding three years and a fine not exceeding five hundred thousand Riyals, or either of these punishments."
      },
      {
        ref: "Art.8", section: "Art.8", chapter: "Chapter 1 – Offences",
        title: "Electronic Fraud",
        content: "Any person who uses information technology to commit fraud or to obtain property or benefits for himself or others by false pretence or fraud shall be punished with imprisonment for a period not exceeding five years and a fine not exceeding five hundred thousand Riyals."
      },
    ]
  },

  // ── Commercial Tenancy (Civil Code provisions on Lease) ───────────────────
  {
    id: "qa-tenancy-law",
    title: "أحكام الإيجار في القانون المدني",
    title_en: "Lease and Tenancy – Civil Code Provisions",
    short_name: "Tenancy / Civil Code Lease",
    issued_date: "2004-01-01",
    in_force_date: "2004-08-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=3980",
    description: "Provisions governing lease contracts under the Qatari Civil Code (Law No. 22 of 2004), applicable to residential and commercial tenancies.",
    provisions: [
      {
        ref: "Art.565", section: "Art.565", chapter: "Chapter 1 – Lease Contract",
        title: "Definition of Lease",
        content: "A lease is a contract by which the lessor undertakes to give the lessee the use and benefit of a specific thing for a specific period in return for a specified rent."
      },
      {
        ref: "Art.572", section: "Art.572", chapter: "Chapter 1 – Lessor Obligations",
        title: "Lessor Obligations",
        content: "The lessor shall: (1) Deliver the leased property to the lessee in a good condition fit for the agreed use. (2) Maintain the leased property during the term of the lease in a condition fit for the agreed use. (3) Ensure the lessee's peaceful enjoyment of the leased property throughout the term."
      },
      {
        ref: "Art.581", section: "Art.581", chapter: "Chapter 2 – Lessee Obligations",
        title: "Lessee Obligations",
        content: "The lessee shall: (1) Use the leased property in a manner consistent with its intended purpose. (2) Pay the rent on the due dates. (3) Return the leased property at the end of the lease term in the same condition as received, subject to fair wear and tear."
      },
      {
        ref: "Art.597", section: "Art.597", chapter: "Chapter 3 – Termination",
        title: "Termination of Lease",
        content: "The lease shall terminate upon expiry of its term. If the lessee continues to occupy the property after the expiry of the term with the knowledge of the lessor and without objection, the lease shall be deemed renewed for a similar period under the same terms. Either party may terminate a lease of undetermined duration by giving notice of not less than three months."
      },
    ]
  },

  // ── Arbitration Law No. 2 of 2017 ─────────────────────────────────────────
  {
    id: "qa-arbitration-law-2-2017",
    title: "قانون التحكيم رقم (2) لسنة 2017",
    title_en: "Arbitration Law No. 2 of 2017",
    short_name: "Arbitration Law 2/2017",
    issued_date: "2017-01-01",
    in_force_date: "2017-07-01",
    url: "https://www.almeezan.qa/LawPage.aspx?id=7800",
    description: "Qatar's primary arbitration law, based on the UNCITRAL Model Law, governing both domestic and international commercial arbitration.",
    provisions: [
      {
        ref: "Art.1", section: "Art.1", chapter: "Chapter 1 – Scope",
        title: "Scope of Application",
        content: "This Law shall apply to commercial arbitration whether domestic or international, where the place of arbitration is Qatar, unless the parties agree to apply the rules of another arbitration institution. This Law is based on the UNCITRAL Model Law on International Commercial Arbitration."
      },
      {
        ref: "Art.9", section: "Art.9", chapter: "Chapter 2 – Arbitration Agreement",
        title: "Arbitration Agreement",
        content: "An arbitration agreement is an agreement by the parties to submit to arbitration all or certain disputes which have arisen or may arise between them in respect of a defined legal relationship, whether contractual or not. The arbitration agreement shall be in writing, either as an arbitration clause in a contract or as a separate agreement."
      },
      {
        ref: "Art.11", section: "Art.11", chapter: "Chapter 2 – Arbitration Agreement",
        title: "Enforceability of Arbitration Agreements",
        content: "A court before which an action is brought in a matter that is the subject of an arbitration agreement shall, if a party so requests not later than when submitting his first statement on the substance of the dispute, refer the parties to arbitration unless it finds that the agreement is null and void, inoperative or incapable of being performed."
      },
      {
        ref: "Art.56", section: "Art.56", chapter: "Chapter 8 – Arbitral Awards",
        title: "Recognition and Enforcement of Awards",
        content: "An arbitral award, irrespective of the country in which it was made, shall be recognised as binding and, upon application in writing to the competent court, shall be enforced. Qatar is a signatory to the 1958 New York Convention on the Recognition and Enforcement of Foreign Arbitral Awards."
      },
    ]
  },
]);

db.close();
console.log(`Database built: ${DB_PATH}`);
console.log(`Laws: 10 | Provisions: ${db.prepare ? 0 : "see output"}`);

const verify = new Database(DB_PATH);
const docCount = verify.prepare("SELECT COUNT(*) as c FROM legal_documents").get().c;
const provCount = verify.prepare("SELECT COUNT(*) as c FROM legal_provisions").get().c;
verify.close();
console.log(`Verified — ${docCount} documents, ${provCount} provisions indexed`);
