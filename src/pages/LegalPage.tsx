import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BotOff,
  CreditCard,
  Download,
  EyeOff,
  FileCheck,
  FileText,
  Gavel,
  HeartHandshake,
  LockKeyhole,
  Mail,
  Megaphone,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Link, Navigate } from "react-router";
import { motion } from "motion/react";
import { BrandLogoMain, BrandMark } from "../components/BrandLogo";
import { PageMeta } from "../components/PageMeta";
import { Panel } from "../components/ui/Panel";
import { pageEntrance } from "../lib/motionPresets";

type PolicySlug =
  | "terms"
  | "privacy"
  | "cookies"
  | "community-guidelines"
  | "copyright"
  | "moderation"
  | "data-export"
  | "account-deletion"
  | "refunds"
  | "appeals"
  | "safety"
  | "content-ownership"
  | "no-dark-patterns"
  | "monetization-ethics"
  | "ai-policy"
  | "security"
  | "vulnerability-disclosure"
  | "transparency"
  | "law-enforcement"
  | "creator-marketplace"
  | "accessibility"
  | "incident-response";

type PolicySection = {
  title: string;
  body?: string;
  items?: string[];
};

type PolicyPageContent = {
  title: string;
  label: string;
  description: string;
  stance: string;
  updated: string;
  icon: LucideIcon;
  sections: PolicySection[];
};

type PolicyGroup = {
  title: string;
  description: string;
  icon: LucideIcon;
  links: PolicySlug[];
};

const updated = "June 26, 2026";
const contactEmail = "hello@thia.lol";
const communityConstitution =
  "Adults can be messy, funny, flirty, weird, political, emotional and chaotic. They cannot abuse, threaten, exploit, stalk or dehumanize people.";

const policies = {
  privacy: {
    title: "Privacy Policy",
    label: "your rights",
    description:
      "What thia.lol collects, why it is collected, how long it is kept, who it is shared with, and how to use privacy rights.",
    stance:
      "We collect the least we reasonably can, explain it clearly, and delete it when we no longer need it.",
    updated,
    icon: LockKeyhole,
    sections: [
      {
        title: "The promise",
        items: [
          "thia.lol does not sell personal data.",
          "thia.lol does not use invasive third-party trackers during public testing.",
          "thia.lol does not build creepy behavioral ad profiles.",
          "Privacy choices should be understandable, reversible where possible, and available without dark patterns.",
        ],
      },
      {
        title: "Data we collect",
        items: [
          "Account and profile data such as handle, display name, email address, password hash, profile text, avatar, banner, links, preferences, role, and account status.",
          "Public content and activity such as posts, replies, rooms, badges, follows, moots, likes, profile modules, layout choices, uploads, and related timestamps.",
          "Direct messages, conversation membership, read state, and message metadata needed to run chat, safety reviews, and legal requests.",
          "Upload and media metadata such as file URL, MIME type, media type, dimensions, poster URL, purpose, and storage metadata.",
          "Security and operational data such as IP address, user agent, request time, authentication events, rate-limit records, diagnostics, and moderation records.",
        ],
      },
      {
        title: "Why we use data",
        items: [
          "To run accounts, profiles, posts, feeds, rooms, messages, notifications, uploads, and settings.",
          "To authenticate users, protect sessions, prevent abuse, apply rate limits, investigate security issues, and keep the service available.",
          "To moderate content, review reports, enforce community rules, protect users, and keep proportionate records of decisions.",
          "To call supported providers only when a feature uses that provider, such as OAuth, metadata refresh, or an embedded card.",
          "To comply with applicable legal obligations and respond to valid privacy, safety, rights, or law-enforcement requests.",
        ],
      },
      {
        title: "Sharing and third parties",
        items: [
          "Hosting and infrastructure providers process data needed for site hosting, file storage, security, and maintenance.",
          "Moderators and admins may access data needed to review reports, enforce rules, maintain the service, or resolve support requests.",
          "Third-party providers may receive data when you connect an account, resolve metadata, render an embed, or interact with their content.",
          "Legal, safety, or rights holders may receive data only when we reasonably believe disclosure is required by valid process, urgent safety needs, or rights enforcement.",
        ],
      },
      {
        title: "Retention",
        items: [
          "Account, content, message, upload, moderation, and security records are kept only as long as needed for the purpose they serve.",
          "Deleted or hidden content may remain in backups, logs, moderation records, report context, or earlier public interactions for a limited period or where retention is necessary.",
          "Detailed retention schedules will become more precise as public testing matures. The principle is storage limitation, not endless collection.",
        ],
      },
      {
        title: "Your rights and choices",
        items: [
          "You can request access to personal data associated with your account.",
          "You can request correction of inaccurate account or profile data.",
          "You can download a self-service JSON export from Settings.",
          "You can schedule account deletion from Settings, with a 30-day grace period before completion.",
          "Where Norway, EU, UK, or similar privacy rules apply, you may also object to or request restriction of certain processing.",
        ],
      },
      {
        title: "Legal reference point",
        body: "This policy is written around practical privacy principles such as transparency, data minimization, purpose limitation, accuracy, storage limitation, and user rights. It is not a substitute for formal legal advice.",
      },
      {
        title: "Contact",
        body: `Privacy questions or rights requests can be sent to ${contactEmail}. Include your handle and enough context to find the relevant account or content.`,
      },
    ],
  },
  "data-export": {
    title: "Data Export / Portability Policy",
    label: "your rights",
    description:
      "How users can access a readable copy of account, profile, content, moderation, and purchase data.",
    stance: "Your data should be accessible to you in a readable format.",
    updated,
    icon: Download,
    sections: [
      {
        title: "Self-service export",
        items: [
          "Signed-in users can request a JSON account export from Settings.",
          "The export requires your current password and a valid session security token.",
          "The file is named like thia-lol-data-export-handle-date.json.",
        ],
      },
      {
        title: "What the export includes",
        items: [
          "Account and profile fields, including profile layout, modules, badges, preferences, and deletion status.",
          "Posts, replies, uploaded media metadata, attachments, reactions, reblogs, rooms you created, and rooms you joined.",
          "Relationship records such as follows, followers, blocks, mutes, stars, and follow requests.",
          "Direct messages you sent, submitted reports, safe moderation status data, and connected integration metadata.",
          "Purchase history when paid features exist. During public testing, this section is expected to be empty.",
        ],
      },
      {
        title: "What the export excludes",
        items: [
          "Password hashes, session token hashes, CSRF tokens, OAuth access tokens, OAuth refresh tokens, provider secrets, and private infrastructure secrets.",
          "Other users' private message bodies, private admin notes about other users, and internal security data that would put people or the service at risk.",
          "Raw database dumps. The export is a readable account-data package, not a copy of every internal table.",
        ],
      },
      {
        title: "Limits",
        body: `Self-service exports may cap large sections for performance. If you need more than the self-service export provides, contact ${contactEmail}.`,
      },
    ],
  },
  "account-deletion": {
    title: "Data Deletion and Account Closure Policy",
    label: "your rights",
    description:
      "What happens when a user schedules account deletion, what is hidden, what may be retained, and how to export before leaving.",
    stance: "Leaving should be easy. We will not hold your data hostage.",
    updated,
    icon: XCircle,
    sections: [
      {
        title: "Current deletion flow",
        items: [
          "You can schedule account deletion from Settings by confirming your current password.",
          "Your profile and content are hidden immediately after deletion is scheduled.",
          "There is a 30-day grace period. During that period, you can sign in and cancel deletion.",
          "Export your account data before scheduling deletion if you want a copy.",
        ],
      },
      {
        title: "What deletion affects",
        items: [
          "Account identity, profile information, posts, replies, rooms you created, uploads, badges, settings, integrations, and messages are in scope for deletion or removal from active use.",
          "Some content may be anonymized, detached, or retained in limited form where needed for legal, safety, moderation, security, backup, or earlier public interaction context.",
          "Public content copied by other people or third-party services may remain outside thia.lol's control.",
        ],
      },
      {
        title: "What may stay temporarily",
        items: [
          "Backups may retain deleted data for a limited backup lifecycle.",
          "Security logs, legal records, chargeback records, abuse records, and moderation context may be retained where necessary.",
          "Reports and appeals may keep enough context to understand a decision and prevent repeat abuse.",
        ],
      },
      {
        title: "Usernames",
        body: "A deleted account's handle may remain reserved for a time to prevent impersonation, confusion, or immediate takeover.",
      },
    ],
  },
  "content-ownership": {
    title: "Content Ownership and License Policy",
    label: "your rights",
    description:
      "Plain-language ownership and license rules for posts, uploads, profiles, and creator content.",
    stance: "You own what you make. We host it; we do not take ownership.",
    updated,
    icon: FileCheck,
    sections: [
      {
        title: "Your content is yours",
        items: [
          "You keep ownership of posts, replies, rooms, profile text, modules, uploads, and creator material you submit.",
          "thia.lol does not claim ownership of user content.",
          "You must have the rights needed for anything you upload, post, link, import, or embed.",
        ],
      },
      {
        title: "Limited license to operate the service",
        items: [
          "By posting or uploading content, you grant thia.lol a limited, worldwide, non-exclusive license to host, store, display, process, copy, resize, moderate, and share that content according to your settings.",
          "This license exists only so thia.lol can run the service, show content where you put it, protect users, and comply with valid legal obligations.",
          "Deleting content ends the license for the deleted material except where retention is technically, legally, or safety-wise necessary.",
        ],
      },
      {
        title: "Creators keep rights",
        body: "Creator features, marketplace tools, donations, paid perks, or profile modules do not transfer ownership of creative work to thia.lol.",
      },
    ],
  },
  refunds: {
    title: "Paid Features, Billing and Refund Policy",
    label: "your rights",
    description:
      "Future-facing rules for purchases, subscriptions, refunds, withdrawal rights, failed payments, and chargebacks.",
    stance: "Money should never be confusing, manipulative, or hostile.",
    updated,
    icon: CreditCard,
    sections: [
      {
        title: "Current status",
        body: "thia.lol does not currently offer paid products. This policy sets the boundary for future paid digital goods, subscriptions, memberships, creator tools, cosmetic items, or other digital services sold directly by thia.lol.",
      },
      {
        title: "Clear pricing",
        items: [
          "Prices, billing periods, renewal behavior, what you receive, and cancellation terms must be shown clearly before purchase.",
          "No hidden fees, cancellation fees, refund fees, surprise renewal traps, or punishment for requesting a refund.",
          "If subscriptions exist later, cancellation must stop future billing and should not delete your thia.lol account.",
        ],
      },
      {
        title: "Our 30-day refund promise",
        items: [
          "You may request a refund for any reason within 30 days of purchase.",
          "You do not need to explain why. You can simply say you want to cancel or refund your thia.lol purchase.",
          "We may ask for basic information needed to find the payment, such as username, purchase email, order ID, date, and product.",
          "We will not make the refund process intentionally difficult, hidden, or misleading.",
        ],
      },
      {
        title: "Legal withdrawal rights",
        items: [
          "This policy does not limit mandatory consumer rights you may have under the laws of your country.",
          "For consumers in Norway and the EEA, online purchases often include a 14-day withdrawal right unless a legal exception applies.",
          "The voluntary 30-day refund promise is meant to give more time than the usual Norwegian/EEA withdrawal period.",
          "If local law gives stronger protection, thia.lol follows that law.",
        ],
      },
      {
        title: "Digital perks after refund",
        body: "If a refund is approved, paid digital perks, subscription access, cosmetic items, creator tools, or platform benefits connected to that purchase may be removed or disabled.",
      },
      {
        title: "Abuse, failed payments, and chargebacks",
        items: [
          "We may review or refuse refund requests when there is strong evidence of fraud, chargeback abuse, payment manipulation, account misuse, or repeated purchases and refunds intended to exploit the platform.",
          "Failed payments may pause or end paid access, but should be explained clearly.",
          "Suspended or banned users may still request eligible refunds within the refund period. Moderation actions do not remove mandatory consumer rights.",
        ],
      },
      {
        title: "How to request a refund",
        body: `Contact ${contactEmail} and include enough information to identify your purchase. A simple message like "I want to request a refund for my thia.lol purchase" is enough.`,
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    label: "your rights",
    description:
      "The cookies and local preferences thia.lol uses for sign-in, security, theme, cookie notice choices, and embeds.",
    stance: "Necessary cookies should protect the service, not become a hidden tracking system.",
    updated,
    icon: EyeOff,
    sections: [
      {
        title: "Current cookie use",
        body: "thia.lol currently uses necessary cookies and local preferences. It does not currently use thia.lol analytics or marketing cookies.",
      },
      {
        title: "Strictly necessary cookies",
        items: [
          "Session cookies keep you signed in and help the service recognize your account securely.",
          "Security cookies or tokens help protect authenticated actions from cross-site request forgery and session abuse.",
          "The cookie notice does not block cookies required for accounts, posting, moderation, uploads, messages, and signed-in features.",
        ],
      },
      {
        title: "Local preferences",
        items: [
          "Theme preference may be stored locally so the site can remember Light or Dark mode.",
          "Cookie notice acknowledgement may be stored in your browser so the same notice is not shown every visit.",
          "Per-profile music continue choices may be stored locally. These preferences are not used for advertising.",
        ],
      },
      {
        title: "Third-party embeds",
        items: [
          "Profile embeds and provider cards may load third-party content only after the provider surface renders.",
          "Spotify music embeds may already be present on a profile before you press Continue to profile.",
          "Third-party providers may set or read cookies they control according to their own policies.",
          "thia.lol does not control provider cookies.",
        ],
      },
    ],
  },
  "community-guidelines": {
    title: "Community Guidelines",
    label: "your safety",
    description:
      "The rules for posts, replies, rooms, profiles, uploads, reports, and DMs on a 16+ social platform.",
    stance:
      "A mature 16+ social space needs clear consent rules, strong boundaries, and real reporting paths.",
    updated,
    icon: HeartHandshake,
    sections: [
      {
        title: "16+ platform boundaries",
        items: [
          "thia.lol is intended for people 16 and older, with a mature European 16+ baseline informed by Norwegian norms and age-of-consent context.",
          "This is adult-first in tone, not a school-safe child platform. People can be expressive, emotional, political, flirty, funny, weird, and imperfect.",
          "You should be mature in your jurisdiction and responsible for following the laws that apply where you live.",
          "Sexual exploitation, sexual content involving minors, grooming, coercion, or sexual pressure are not allowed.",
        ],
      },
      {
        title: "Not allowed",
        items: [
          "Harassment, stalking, threats, targeted abuse, or coordinated dogpiling.",
          "Hate content that attacks, dehumanizes, or promotes exclusion or violence against protected or vulnerable groups.",
          "Doxxing, private information sharing, non-consensual intimate content, impersonation, scams, spam, malware, or illegal content.",
          "Self-harm encouragement, exploitation of vulnerable people, or pressure into unwanted contact.",
          "Using profile modules, embeds, music cards, creator links, rooms, or DMs to evade site rules.",
        ],
      },
      {
        title: "Rooms and DMs",
        items: [
          "Rooms may have extra rules about topic, tone, and participation.",
          "Room-specific rules cannot override site-wide safety rules.",
          "DMs are covered by the same rules as public spaces, even when the conversation is private.",
        ],
      },
      {
        title: "Reporting",
        body: "Use report tools where available or contact the Trust Center address for sensitive safety, privacy, copyright, or account concerns.",
      },
    ],
  },
  safety: {
    title: "Safety and Abuse Response Policy",
    label: "your safety",
    description:
      "How thia.lol handles urgent harm, abuse reports, compromised accounts, and illegal-content concerns.",
    stance:
      "When someone's safety is at risk, we act quickly, preserve evidence where appropriate, and do not force users through confusing reporting mazes.",
    updated,
    icon: ShieldAlert,
    sections: [
      {
        title: "Urgent safety categories",
        items: [
          "Credible threats of violence, stalking, doxxing, non-consensual intimate content, sexual exploitation, targeted harassment, spam raids, impersonation, compromised accounts, and illegal content reports.",
          "Self-harm or crisis signals may require a safety-first response rather than ordinary moderation pacing.",
          "Reports involving minors, coercion, exploitation, or immediate danger are treated as high priority.",
        ],
      },
      {
        title: "How we respond",
        items: [
          "We may remove or hide content, limit features, suspend accounts, preserve evidence, lock compromised sessions, or escalate to appropriate services when required or appropriate.",
          "We try to minimize repeated explanation demands from people reporting abuse.",
          "We do not promise that every issue is solved instantly, but urgent risk should not sit in a confusing queue.",
        ],
      },
      {
        title: "Reporting channel",
        body: `Use in-product reporting where available. For urgent safety context that does not fit the form, contact ${contactEmail}.`,
      },
    ],
  },
  moderation: {
    title: "Moderation Policy",
    label: "your safety",
    description:
      "How reports, human review, warnings, restrictions, suspensions, bans, appeals, and transparency basics work.",
    stance:
      "We will explain moderation decisions clearly, give users a meaningful way to appeal, and avoid punishment without context unless safety requires immediate action.",
    updated,
    icon: Scale,
    sections: [
      {
        title: "Moderation approach",
        body: "thia.lol uses human admin/moderator review for reports and enforcement decisions. Automated systems may help route or organize work later, but final moderation action should have human accountability.",
      },
      {
        title: "Report flow",
        items: [
          "Logged-in users can report posts, replies, profiles, rooms, and chat messages where report tools are available.",
          "Reports ask for a category and optional context so moderators can compare the issue with the Community Guidelines.",
          "Profile reports can include modules, linked content, embedded content, gallery media, creator modules, music modules, backgrounds, and integration-derived metadata.",
        ],
      },
      {
        title: "Possible actions",
        items: [
          "No action, warning, content removal, content hiding, feature restriction, room-level action, temporary suspension, account closure, or preservation for safety/legal/security review.",
          "Urgent safety, legal, or security issues may require immediate action before full context is available.",
          "Repeat violations can increase severity, but context still matters.",
        ],
      },
      {
        title: "Notification and appeals",
        items: [
          "When practical, users should be told what rule was involved and what action was taken.",
          "Appeals are available through the Appeals Policy contact path until a fuller in-product system exists.",
          "Moderator conflicts of interest should be avoided. A moderator should not be the sole reviewer of a dispute they are personally involved in.",
        ],
      },
      {
        title: "Transparency",
        body: "thia.lol is not claiming very-large-platform obligations. DSA-inspired transparency is used as a practical baseline for clearer moderation processes, user rights, and future reports.",
      },
    ],
  },
  appeals: {
    title: "Appeals Policy",
    label: "your safety",
    description:
      "How users can challenge content removals, account restrictions, suspensions, bans, and other moderation decisions.",
    stance: "We can make mistakes. You can challenge decisions. When we are wrong, we will fix it.",
    updated,
    icon: UserCheck,
    sections: [
      {
        title: "What can be appealed",
        items: [
          "Content removal, content hiding, account restrictions, suspensions, bans, room actions, and moderation labels or status decisions.",
          "Copyright or legal takedown disputes may require extra rights information.",
          "Emergency safety removals can still be appealed after the immediate risk is handled.",
        ],
      },
      {
        title: "How to appeal",
        items: [
          `Contact ${contactEmail} until the in-product appeal flow exists.`,
          "Include your handle, affected content or URL, the decision you want reviewed, and context that may change the outcome.",
          "Do not include private information about other people unless it is necessary to understand the decision.",
        ],
      },
      {
        title: "Review goals",
        items: [
          "Appeals should be reviewed by someone who was not the original conflicted decision-maker when practical.",
          "We aim to respond in a reasonable time, prioritizing account access, safety mistakes, and removals with large impact.",
          "If we were wrong, we will correct the decision, restore content where possible, and update records as needed.",
        ],
      },
    ],
  },
  accessibility: {
    title: "Accessibility Policy",
    label: "your safety",
    description:
      "The accessibility commitments for navigation, readable UI, motion, alt text, reporting, deletion, and account controls.",
    stance:
      "People should not need perfect vision, motor control, hearing, or mental energy to use the site.",
    updated,
    icon: Accessibility,
    sections: [
      {
        title: "Commitments",
        items: [
          "Support keyboard navigation for core flows.",
          "Use readable contrast, clear focus states, and screen-reader-friendly controls.",
          "Support alt text where media features need it.",
          "Respect reduced motion preferences.",
          "Avoid relying on color alone to communicate important state.",
          "Keep reporting, export, deletion, refund, and privacy flows understandable.",
        ],
      },
      {
        title: "Known limits",
        body: "thia.lol is still in public testing. Accessibility issues should be treated as product bugs, not as edge cases.",
      },
    ],
  },
  "no-dark-patterns": {
    title: "No Dark Patterns Policy",
    label: "our promises",
    description:
      "A public promise not to trick users in privacy, money, content, account, consent, deletion, or support flows.",
    stance:
      "If a choice affects your privacy, money, content, or account, it should be clear, reversible where possible, and not designed to trick you.",
    updated,
    icon: Sparkles,
    sections: [
      {
        title: "What we will not do",
        items: [
          "Hidden cancel buttons, guilt-tripping confirmations, fake urgency, confusing privacy choices, or pre-ticked marketing consent.",
          "Buried unsubscribe links, misleading accept-all designs, hard-to-find deletion, trick wording, or hostile support loops.",
          "Designing refund, deletion, export, or reporting flows to exhaust people until they give up.",
        ],
      },
      {
        title: "Design standard",
        body: "The honest path should be the normal path. If a user can sign up, pay, post, consent, or connect something easily, they should also be able to understand and undo it without a maze.",
      },
    ],
  },
  "monetization-ethics": {
    title: "Advertising and Monetization Ethics Policy",
    label: "our promises",
    description:
      "The boundary for future monetization: no surveillance ads, no selling personal data, no paid trust shortcuts.",
    stance: "If we monetize, we do it without betraying users.",
    updated,
    icon: Megaphone,
    sections: [
      {
        title: "Current status",
        items: [
          "No ads during public testing.",
          "No selling personal data.",
          "Donations, subscriptions, or clear paid features are preferred over surveillance advertising.",
        ],
      },
      {
        title: "Hard boundaries",
        items: [
          "No sensitive-data targeting.",
          "No ads based on private messages.",
          "No manipulative political, crisis, or distress-based advertising.",
          "Sponsored content, if it ever exists, must be clearly labeled.",
          "No paid verification and no paid reach boosting unless the design is reviewed with extreme care first.",
        ],
      },
      {
        title: "Ad transparency",
        body: "If thia.lol ever runs advertising or sponsored surfaces, the rules and labels must be updated before launch, not after users are surprised.",
      },
    ],
  },
  "ai-policy": {
    title: "AI Policy",
    label: "our promises",
    description:
      "How thia.lol treats AI-generated media, moderation assistance, model training, and third-party AI providers.",
    stance: "We will not feed your posts, messages, or identity into AI systems.",
    updated,
    icon: BotOff,
    sections: [
      {
        title: "AI-generated media is not allowed",
        items: [
          "AI-generated images, video, audio, avatars, profile media, post media, and creator media are not allowed on thia.lol.",
          "This is a platform boundary for ethical and environmental reasons, and so users do not need to wonder whether public media is synthetic.",
          "If AI-generated media is reported or detected, it may be removed or restricted.",
        ],
      },
      {
        title: "Training and providers",
        items: [
          "thia.lol will not train AI models on private user content.",
          "thia.lol will not sell, license, or provide posts, messages, uploads, profiles, or identity data for model training.",
          "Private messages and identity data should not be sent to third-party AI providers for ordinary product features.",
        ],
      },
      {
        title: "Moderation",
        body: "AI may not be the sole final decision-maker for enforcement. Human review remains required for moderation actions.",
      },
    ],
  },
  transparency: {
    title: "Transparency Report Policy",
    label: "our promises",
    description:
      "What thia.lol intends to track and publish as the platform grows.",
    stance: "Trust is earned through receipts.",
    updated,
    icon: FileText,
    sections: [
      {
        title: "Future reports should track",
        items: [
          "Moderation actions, content removals by category, account suspensions, appeals received, and appeals overturned.",
          "Government or legal requests, data requests, security incidents, refunds processed, and uptime incidents.",
          "Meaningful methodology notes so the numbers do not become decorative theater.",
        ],
      },
      {
        title: "Current status",
        body: "thia.lol does not yet publish a full periodic transparency report. This policy records the intended public accountability path before the platform gets larger.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    label: "platform operations",
    description:
      "The contract for accounts, acceptable use, service availability, paid features, intellectual property, liability, and disputes.",
    stance: "Your content is yours. We only get the permission needed to run the service.",
    updated,
    icon: Gavel,
    sections: [
      {
        title: "Who can use thia.lol",
        items: [
          "thia.lol is intended for users 16 and older, with a mature European 16+ baseline informed by Norwegian norms and age-of-consent context.",
          "You should be mature in your jurisdiction and able to use an adult-first social platform responsibly under the laws that apply where you live.",
          "You may use thia.lol only if you can follow these terms, the Community Guidelines, and applicable law.",
          "If access is invite-only, restricted, or moderated during testing, do not work around those limits.",
        ],
      },
      {
        title: "Account responsibility",
        items: [
          "You are responsible for activity through your account.",
          "Use an email address you control, keep your password private, and tell us if you think your account was accessed without permission.",
          "Do not sell, transfer, or share accounts in a way that misleads people or bypasses moderation.",
        ],
      },
      {
        title: "Your content",
        items: [
          "You keep ownership of the posts, replies, reblogs, room content, profile text, modules, images, videos, galleries, rich cards, and other content you create, upload, link, import, or embed.",
          "By posting or uploading content, you give thia.lol a limited, worldwide, non-exclusive license to host, store, display, process, copy, resize, moderate, and distribute that content as needed to operate the service according to your settings.",
          "This license does not transfer ownership to thia.lol.",
          "When you delete content or your account, the license ends for deleted material except where retention is reasonably needed for backups, security, legal, moderation, or earlier public interactions.",
        ],
      },
      {
        title: "Acceptable use",
        items: [
          "Do not post illegal content, threats, harassment, hate content, non-consensual sexual content, private personal information, scams, spam, malware, or infringing material.",
          "Do not impersonate people, evade moderation, abuse reporting tools, automate disruptive activity, or interfere with the service.",
          "Do not use thia.lol to coordinate harm, exploit vulnerable people, or pressure others into unwanted contact.",
        ],
      },
      {
        title: "Paid features",
        body: "thia.lol does not currently offer paid products. If paid features are added, the Refund Policy and clear purchase terms apply.",
      },
      {
        title: "Service availability",
        body: "thia.lol is provided as-is and may change, break, pause, or stop. Keep your own copies of important content.",
      },
      {
        title: "Termination",
        body: "You may stop using thia.lol at any time. We may restrict, suspend, or close accounts that break rules, create risk for others, or put the service at legal or security risk. Appeals are available.",
      },
    ],
  },
  security: {
    title: "Security Policy",
    label: "platform operations",
    description:
      "How thia.lol protects accounts and what users should do if something goes wrong.",
    stance: "We protect user accounts like they matter, because they do.",
    updated,
    icon: ShieldCheck,
    sections: [
      {
        title: "Account protection",
        items: [
          "Passwords are stored as hashes, not plain text.",
          "Sessions use HttpOnly, Secure, SameSite=Lax cookies in production.",
          "Authenticated mutating requests require CSRF protection.",
          "Session tokens are stored as hashes server-side.",
          "Two-factor authentication exists for supported accounts, and broader security controls will continue improving.",
        ],
      },
      {
        title: "Operational security",
        items: [
          "Admin access should be limited to people who need it.",
          "Raw exception details should be hidden in production.",
          "Audit logs and suspicious-login handling should become more visible as the platform grows.",
          "If a breach affects users, thia.lol should notify affected users and relevant authorities where required.",
        ],
      },
      {
        title: "If something is wrong",
        body: `If you believe your account or the service is at risk, contact ${contactEmail} with the relevant handle, URL, and what happened.`,
      },
    ],
  },
  "vulnerability-disclosure": {
    title: "Vulnerability Disclosure Policy",
    label: "platform operations",
    description:
      "How security researchers can report issues safely and what testing is allowed.",
    stance: "If you report security issues responsibly, we will treat you as helping, not as an enemy.",
    updated,
    icon: AlertTriangle,
    sections: [
      {
        title: "How to report",
        body: `Send security reports to ${contactEmail}. Include the affected URL, steps to reproduce, impact, and any screenshots or request IDs that help us verify safely.`,
      },
      {
        title: "Allowed testing",
        items: [
          "Testing your own account and content.",
          "Low-impact verification that does not degrade service, bypass privacy, or access another user's data.",
          "Reporting promptly and giving reasonable time to fix before public disclosure.",
        ],
      },
      {
        title: "Not allowed",
        items: [
          "Accessing, modifying, deleting, or exfiltrating other users' data.",
          "Destructive testing, spam, social engineering, phishing, malware, denial of service, or persistence.",
          "Public disclosure before a reasonable fix window.",
        ],
      },
      {
        title: "Rewards",
        body: "thia.lol does not currently run a paid bug bounty. Responsible reports are still appreciated and taken seriously.",
      },
    ],
  },
  "law-enforcement": {
    title: "Law Enforcement and Government Request Policy",
    label: "platform operations",
    description:
      "How thia.lol responds to legal process, government requests, emergency requests, and user notice.",
    stance: "We do not hand over user data casually.",
    updated,
    icon: Scale,
    sections: [
      {
        title: "Our standard",
        items: [
          "Require valid legal process before disclosing user data unless a credible emergency exception applies.",
          "Review requests carefully and reject or narrow overbroad, vague, or improper requests where possible.",
          "Notify users before disclosure unless legally prohibited, unsafe, or harmful to an active investigation.",
          "Track request numbers for future transparency reporting.",
        ],
      },
      {
        title: "Emergency requests",
        body: "If there is credible imminent harm, thia.lol may preserve or disclose limited information where legally allowed or required to protect safety.",
      },
      {
        title: "Contact",
        body: `Government or law-enforcement requests should be sent to ${contactEmail} with clear legal authority and contact information.`,
      },
    ],
  },
  "creator-marketplace": {
    title: "Creator / Marketplace Policy",
    label: "platform operations",
    description:
      "Future-facing rules for creator eligibility, payouts, fees, prohibited sales, taxes, disputes, and adult-content limits.",
    stance: "Creators deserve clear rules, fair cuts, and no surprise platform nonsense.",
    updated,
    icon: CreditCard,
    sections: [
      {
        title: "Current status",
        body: "thia.lol does not currently operate a marketplace, creator payout system, or paid creator feature set. This policy sets the expectations before those tools exist.",
      },
      {
        title: "Future rules must cover",
        items: [
          "Creator eligibility, payout timing, platform fees, refund handling, tax responsibility, disputes, and chargebacks.",
          "Prohibited sales, illegal goods or services, scams, intellectual-property violations, and unsafe adult-content boundaries.",
          "Clear disclosure of what creators receive, what buyers receive, and what thia.lol does or does not guarantee.",
        ],
      },
      {
        title: "Fairness principle",
        body: "Creator monetization should not become a confusing platform tax, a surprise fee machine, or a way to bypass safety rules.",
      },
    ],
  },
  "incident-response": {
    title: "Incident Response Policy",
    label: "platform operations",
    description:
      "How thia.lol should communicate about outages, data incidents, payment problems, moderation failures, and accidental removals.",
    stance: "If we break something, we explain it, fix it, and learn from it.",
    updated,
    icon: ShieldAlert,
    sections: [
      {
        title: "Incident types",
        items: [
          "Outages, data incidents, security bugs, payment problems, moderation failures, accidental removals, and major feature regressions.",
          "Incidents should be handled according to user impact, safety risk, and legal obligations.",
        ],
      },
      {
        title: "Response expectations",
        items: [
          "Investigate the issue, protect users, restore service, and communicate status when the impact is meaningful.",
          "After serious incidents, write down what happened, what changed, and what still needs work.",
          "Avoid vague public updates when concrete information is available.",
        ],
      },
    ],
  },
  copyright: {
    title: "Copyright and Takedown Policy",
    label: "platform operations",
    description:
      "How thia.lol handles copyright concerns, takedown requests, repeat infringement, and disputes.",
    stance: "Creative rights matter. So do fair mistakes and clear correction paths.",
    updated,
    icon: FileText,
    sections: [
      {
        title: "Respect creative rights",
        body: "Only post, upload, link, embed, import, or feature content you own, created, licensed, or are otherwise allowed to use.",
      },
      {
        title: "Reporting copyright infringement",
        items: [
          `Send copyright or takedown concerns to ${contactEmail}.`,
          "Include your name or organization, contact email, and a clear description of the copyrighted work.",
          "Include the thia.lol URL or enough detail to identify the allegedly infringing content.",
          "Explain why you believe the use is unauthorized and confirm that your report is accurate.",
        ],
      },
      {
        title: "What may happen",
        items: [
          "We may remove, hide, restrict, or keep content unavailable while reviewing a rights concern.",
          "We may contact the person who posted the content when appropriate.",
          "We may reject incomplete, abusive, or unclear reports.",
          "Accounts that repeatedly post infringing content may be restricted or suspended.",
        ],
      },
      {
        title: "Disputes",
        body: "There is no automated counter-notice system yet. If your content was removed for copyright reasons and you believe that was a mistake, contact us with the content, account, reason, and rights information you want reviewed.",
      },
      {
        title: "Third-party brand icons",
        body: "Profile connection brand icons are provided through Simple Icons via react-icons. Brand names, logos, and trademarks belong to their respective owners. Their display does not imply endorsement, sponsorship, or affiliation with thia.lol.",
      },
    ],
  },
} satisfies Record<PolicySlug, PolicyPageContent>;

const policyGroups: PolicyGroup[] = [
  {
    title: "Your rights",
    description: "Privacy, deletion, portability, ownership, refunds, and cookies.",
    icon: LockKeyhole,
    links: ["privacy", "data-export", "account-deletion", "content-ownership", "refunds", "cookies"],
  },
  {
    title: "Your safety",
    description: "Community rules, urgent abuse response, moderation, appeals, and access.",
    icon: ShieldAlert,
    links: ["community-guidelines", "safety", "moderation", "appeals", "accessibility"],
  },
  {
    title: "Our promises",
    description: "No dark patterns, ethical monetization, no AI-generated media, and receipts.",
    icon: Sparkles,
    links: ["no-dark-patterns", "monetization-ethics", "ai-policy", "transparency"],
  },
  {
    title: "Platform operations",
    description: "Terms, security, reports, legal requests, creator tools, incidents, and copyright.",
    icon: Gavel,
    links: [
      "terms",
      "security",
      "vulnerability-disclosure",
      "law-enforcement",
      "creator-marketplace",
      "incident-response",
      "copyright",
    ],
  },
];

const quickPromiseSlugs: PolicySlug[] = [
  "content-ownership",
  "account-deletion",
  "appeals",
  "monetization-ethics",
  "ai-policy",
];

export function LegalIndexPage() {
  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Trust Center"
        description="Privacy, safety, rights, moderation, and platform policy center for thia.lol."
        path="/legal"
      />

      <Panel className="overflow-hidden p-0">
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-normal text-text sm:text-5xl">
              Trust Center
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">
              thia.lol exists because users choose to trust us. We do not take
              that lightly.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              We put user privacy, safety, transparency, and control before
              short-term profit. Our users are not products, metrics, inventory,
              or growth targets. They are people.
            </p>
          </div>
          <BrandLogoMain
            data-testid="legal-brand-logo-main"
            size="lg"
            className="justify-self-start lg:justify-self-end"
          />
        </div>

        <div className="grid gap-px border-t border-line bg-line md:grid-cols-3">
          <TrustStatement title="Legal layer" body="Required policies, account rules, copyright, payments, and contact paths." />
          <TrustStatement title="Safety layer" body="Community boundaries, report handling, moderation, appeals, and urgent harm response." />
          <TrustStatement title="Better layer" body="Public promises against dark patterns, surveillance monetization, and AI media drift." />
        </div>
      </Panel>

      <section className="grid gap-4" aria-label="Trust Center policy groups">
        {policyGroups.map((group) => (
          <PolicyGroupPanel key={group.title} group={group} />
        ))}
      </section>

      <Panel className="p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-center">
          <div>
            <h2 className="text-xl font-semibold text-text">The public promises</h2>
            <div className="mt-3 grid gap-2">
              {quickPromiseSlugs.map((slug) => (
                <p key={slug} className="text-sm leading-6 text-muted">
                  <span className="font-semibold text-text">{policies[slug].title}:</span>{" "}
                  {policies[slug].stance}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-card border border-line bg-canvas/45 p-4">
            <div className="flex items-start gap-3">
              <Mail aria-hidden="true" className="mt-0.5 text-muted" size={18} />
              <div>
                <h2 className="text-sm font-semibold text-text">Contact</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Use{" "}
                  <a
                    className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
                    href={`mailto:${contactEmail}`}
                  >
                    {contactEmail}
                  </a>{" "}
                  for privacy requests, copyright notices, moderation appeals,
                  safety concerns, refunds, or legal questions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

export function LegalContactRedirect() {
  return <Navigate to="/legal" replace />;
}

export function PolicyRoutePage({ slug }: { slug: PolicySlug }) {
  return <PolicyPage slug={slug} />;
}

export function TermsPage() {
  return <PolicyPage slug="terms" />;
}

export function PrivacyPage() {
  return <PolicyPage slug="privacy" />;
}

export function CookiesPage() {
  return <PolicyPage slug="cookies" />;
}

export function CommunityGuidelinesPage() {
  return <PolicyPage slug="community-guidelines" />;
}

export function CopyrightPage() {
  return <PolicyPage slug="copyright" />;
}

export function ModerationPage() {
  return <PolicyPage slug="moderation" />;
}

function PolicyPage({ slug }: { slug: PolicySlug }) {
  const policy = policies[slug];
  const Icon = policy.icon;

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={policy.title}
        description={policy.description}
        path={`/${slug}`}
      />

      <Panel className="overflow-hidden p-0">
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Link
                to="/legal"
                className="underline-offset-4 hover:text-text hover:underline"
              >
                Trust Center
              </Link>
              <ArrowRight aria-hidden="true" size={14} />
              <span>{policy.label}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
              {policy.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
              {policy.description}
            </p>
            <p className="mt-4 text-sm text-muted">Last updated: {policy.updated}</p>
          </div>
          <div className="flex items-center gap-3 lg:flex-col lg:items-end">
            <BrandMark
              className="shadow-soft"
              data-testid="policy-brand-mark"
              shape="squircle"
              size="lg"
            />
            <span className="grid size-10 place-items-center rounded-card border border-line bg-canvas/50 text-accent-strong">
              <Icon aria-hidden="true" size={19} />
            </span>
          </div>
        </div>

        <div className="border-t border-line bg-canvas/35 p-5 sm:p-6">
          <p className="max-w-4xl text-lg font-semibold leading-8 text-text">
            {policy.stance}
          </p>
        </div>
      </Panel>

      {slug === "community-guidelines" ? <CommunitySeal /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel className="divide-y divide-line overflow-hidden">
          {policy.sections.map((section) => (
            <PolicySectionView key={section.title} section={section} />
          ))}
        </Panel>
        <PolicyLinkGrid currentSlug={slug} />
      </div>
    </motion.div>
  );
}

function TrustStatement({ body, title }: { body: string; title: string }) {
  return (
    <div className="bg-surface/80 p-4">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function PolicyGroupPanel({ group }: { group: PolicyGroup }) {
  const Icon = group.icon;

  return (
    <Panel className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-canvas/55 text-accent-strong">
            <Icon aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-text">{group.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{group.description}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {group.links.map((slug) => {
            const policy = policies[slug];
            const PolicyIcon = policy.icon;

            return (
              <Link
                key={slug}
                to={`/${slug}`}
                className="group flex min-h-[5rem] gap-3 rounded-card border border-line bg-canvas/45 p-3 transition duration-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface/70 text-muted">
                  <PolicyIcon aria-hidden="true" size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">{policy.title}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                    {policy.stance}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-muted transition duration-fluid group-hover:translate-x-0.5 group-hover:text-text"
                  size={15}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function CommunitySeal() {
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <BrandMark
          aria-label="thia.lol bunny seal"
          className="shadow-soft"
          shape="squircle"
          size="md"
        />
        <div>
          <h2 className="text-base font-semibold text-text">Community constitution</h2>
          <p className="mt-2 text-sm leading-7 text-muted">{communityConstitution}</p>
        </div>
      </div>
    </Panel>
  );
}

function PolicySectionView({ section }: { section: PolicySection }) {
  return (
    <section className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold tracking-normal text-text">
        {section.title}
      </h2>
      {section.body ? (
        <p className="mt-3 text-sm leading-7 text-muted">{section.body}</p>
      ) : null}
      {section.items ? (
        <ul className="mt-3 space-y-2 text-sm leading-7 text-muted">
          {section.items.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PolicyLinkGrid({ currentSlug }: { currentSlug?: PolicySlug }) {
  return (
    <Panel className="p-4 sm:p-5 lg:sticky lg:top-24">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <FileText aria-hidden="true" size={17} />
        Policy pages
      </div>
      <div className="mt-4 grid gap-4">
        {policyGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {group.title}
            </h2>
            <div className="mt-2 grid gap-1.5">
              {group.links.map((slug) => (
                <Link
                  key={slug}
                  to={`/${slug}`}
                  aria-current={currentSlug === slug ? "page" : undefined}
                  className="group flex min-h-10 items-center justify-between gap-3 rounded-control border border-transparent px-2.5 py-1.5 text-sm font-medium text-muted transition duration-fluid hover:border-line hover:bg-canvas/45 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:border-line-strong aria-[current=page]:bg-canvas/55 aria-[current=page]:text-text"
                >
                  {policies[slug].title}
                  <ArrowRight
                    aria-hidden="true"
                    className="transition duration-fluid group-hover:translate-x-0.5"
                    size={14}
                  />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
