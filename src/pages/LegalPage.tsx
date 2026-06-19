import { ArrowRight, FileText, Mail } from "lucide-react";
import { Link, Navigate } from "react-router";
import { motion } from "motion/react";
import { BrandLogoMain, BrandMark } from "../components/BrandLogo";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { pageEntrance } from "../lib/motionPresets";

type PolicySection = {
  title: string;
  body?: string;
  items?: string[];
};

type PolicyPageContent = {
  title: string;
  label: string;
  description: string;
  updated: string;
  sections: PolicySection[];
};

const updated = "June 17, 2026";
const contactEmail = "hello@thia.lol";

const policyLinks = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/cookies", label: "Cookies" },
  { to: "/community-guidelines", label: "Community Guidelines" },
  { to: "/copyright", label: "Copyright" },
  { to: "/moderation", label: "Moderation" },
  { to: "/legal", label: "Legal Contact" },
];

const policies: Record<string, PolicyPageContent> = {
  terms: {
    title: "Terms of Service",
    label: "terms",
    description:
      "The plain-language terms for using thia.lol accounts, posts, rooms, DMs, uploads, and moderation.",
    updated,
    sections: [
      {
        title: "About these terms",
        body: "These terms explain the practical rules for using thia.lol. They are written for a small social platform and are not formal legal advice.",
      },
      {
        title: "Who can use thia.lol",
        items: [
          "You may use thia.lol if you can follow these terms and applicable law.",
          "The service is intended for adults. Do not use it if you are not allowed to use social platforms in your country or region.",
          "If access is restricted, invite-only, or moderated during an early launch period, you must not work around those limits.",
        ],
      },
      {
        title: "Account responsibility",
        items: [
          "You are responsible for what happens through your account.",
          "Use a real email address you control when one is requested, keep your password private, and tell us if you think your account was accessed without permission.",
          "Do not sell, transfer, or share accounts in a way that misleads other people or bypasses moderation.",
        ],
      },
      {
        title: "Your content",
        items: [
          "You keep ownership of the posts, replies, reblogs, room content, profile text, profile modules, images, videos, galleries, rich cards, and other content you create, upload, link, import, or embed.",
          "By posting or uploading content, you give thia.lol a limited, worldwide, non-exclusive license to host, store, display, process, copy, resize, moderate, and distribute that content as needed to operate and improve the service.",
          "This license lets the platform show your content in feeds, profiles, rooms, notifications, search or discovery surfaces, shared public pages, profile canvases, modules, and background media. It does not transfer ownership to thia.lol.",
          "You are responsible for making sure linked, imported, embedded, or integration-derived content is lawful, allowed by the third-party service, and appropriate under these terms.",
          "When you delete content or your account, the license ends for the deleted material except where retention is reasonably needed for backups, security, legal, moderation, or earlier public interactions such as replies or reblogs.",
        ],
      },
      {
        title: "Profiles, modules, and integrations",
        items: [
          "Profiles can include modules such as profile info, about/status, links, badges, gallery/media, creator cards, music cards, featured posts, featured rooms, feed, and integration-rich cards.",
          "You may connect or use supported provider links for Spotify, Apple Music, YouTube, Twitch, GitHub, and future supported integrations when those integrations are available.",
          "OAuth connections, provider API metadata, and generated embeds are optional profile features. Do not use them to mislead people about live status, endorsement, sponsorship, verification, or ownership.",
          "Removing a profile module removes it from the canvas; it does not delete the underlying post, room, repository, provider account, track, video, stream, or linked third-party content.",
        ],
      },
      {
        title: "Prohibited content and behavior",
        items: [
          "Do not post, upload, link, import, embed, or feature illegal content, threats, harassment, hate content, non-consensual sexual content, private personal information, scams, spam, malware, or content that infringes someone else's rights.",
          "Do not impersonate people, evade moderation, abuse reporting tools, automate disruptive activity, or interfere with the service.",
          "Do not use thia.lol to coordinate harm, exploit vulnerable people, or pressure others into unwanted contact.",
        ],
      },
      {
        title: "Rooms and communities",
        items: [
          "Rooms are shared spaces. Follow the platform rules and any extra room rules set by room owners or moderators.",
          "Room owners and moderators may set topic boundaries, remove off-topic posts, and take room-level actions when those tools exist.",
          "Room rules cannot override the site-wide terms or community guidelines.",
        ],
      },
      {
        title: "Uploads and media",
        items: [
          "Only upload images or videos you own, created, or have permission to use.",
          "Uploads must follow the same rules as text posts. Do not upload illegal, infringing, deceptive, abusive, or non-consensual material.",
          "Image backgrounds, video backgrounds, gallery modules, rich cards, creator modules, and music modules must remain readable, lawful, and safe.",
          "Image uploads may be resized, converted, stripped of metadata, or removed to operate the service and keep it safe. Video background uploads may be limited by file type, size, purpose, and playback safety.",
          "Music playback on public profiles may ask visitors to continue first. If a visitor continues, the browser may try to start the embedded provider player, but playback can still be blocked by browser or provider rules.",
        ],
      },
      {
        title: "Embedded and external content",
        items: [
          "thia.lol may generate allowlisted embeds or rich cards from normalized provider URLs. The platform does not allow arbitrary user-supplied iframe HTML.",
          "Embeds and linked provider cards can load content controlled by third parties. Their availability, privacy behavior, tracking, and content rules are controlled by those providers.",
          "External links, embeds, repositories, streams, videos, tracks, playlists, and creator pages remain subject to the third-party service's terms and moderation.",
        ],
      },
      {
        title: "DMs and chat",
        items: [
          "Direct messages are still covered by these terms and the community guidelines.",
          "Do not use DMs for harassment, threats, scams, unwanted sexual content, or sharing private information without consent.",
          "DMs should not be treated as a secure emergency channel or a place for highly sensitive information.",
        ],
      },
      {
        title: "Moderation and enforcement",
        items: [
          "Reports may be reviewed by admins or moderators.",
          "We may remove or hide content, restrict features, suspend accounts, resolve reports, or take room-level action when needed.",
          "We try to make moderation proportionate, but urgent safety, legal, or security issues may require faster action.",
        ],
      },
      {
        title: "Termination or suspension",
        items: [
          "You may stop using thia.lol at any time.",
          "We may suspend, restrict, or close accounts that break these terms, create risk for others, or put the service at legal or security risk.",
          "If there is no automated appeal tool, you can contact us manually and include the account, content, and decision you want reviewed.",
        ],
      },
      {
        title: "Service availability and no warranty",
        items: [
          "thia.lol is provided as-is and may change, break, pause, or stop.",
          "We do not promise uninterrupted availability, permanent storage, legal outcomes, or that every harmful post will be found immediately.",
          "Use the service at your own discretion and keep your own copies of important content.",
        ],
      },
      {
        title: "Changes to these terms",
        body: "We may update these terms as the platform changes. When changes are meaningful, we will try to make them visible in a reasonable way. Continued use after an update means the new terms apply.",
      },
      {
        title: "Contact",
        body: `Questions about these terms can be sent to ${contactEmail}.`,
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    label: "privacy",
    description:
      "How thia.lol collects, uses, shares, and protects account, profile, post, room, DM, upload, log, and cookie data.",
    updated,
    sections: [
      {
        title: "About this policy",
        body: "This policy explains the personal data thia.lol handles to run the platform. It is written for practical transparency and should be reviewed as the service grows.",
      },
      {
        title: "Data we collect",
        items: [
          "Account and profile data, such as handle, display name, email address when provided, password hash, profile text, avatar, banner, links, preferences, role, and account status.",
          "Public content and activity, including posts, replies, reblogs, rooms, follows, moots, badges, likes, profile modules, canvas layout, background blur, image/video background choices, rich cards, and related timestamps.",
          "Direct messages, conversation membership, read state, message metadata, and message content as needed to operate chat, deliver notifications, maintain safety, and handle reports or legal requests.",
          "Uploads, including the image or video file you provide, public media URLs, dimensions or MIME/type metadata, purpose, and storage metadata needed to display and manage uploaded media.",
          "Integration data when you connect or use providers, such as provider name, provider account id or handle, display name, avatar URL, granted scopes, token expiry, connection status, revoked/error timestamps, normalized provider URLs, cached metadata, generated embed metadata, and fetch timestamps.",
          "Logs and security data, such as IP address, user agent, request time, authentication events, rate-limit records, error diagnostics, and moderation records.",
          "Cookies, session data, CSRF/security tokens, and local preference records used for sign-in, security, theme, cookie notice choices, and per-profile music continue choices.",
        ],
      },
      {
        title: "Why we use data",
        items: [
          "To operate the platform, show profiles, posts, feeds, rooms, messages, notifications, uploads, and account state.",
          "To render profile canvases, rich cards, profile backgrounds, media modules, creator modules, music modules, and integration metadata that you choose to add.",
          "To authenticate users, protect sessions, prevent abuse, apply rate limits, and investigate security problems.",
          "To moderate content, review reports, enforce rules, protect users, and maintain admin/moderation records.",
          "To personalize basic feeds and recommendations using explainable factors such as recency, follows, moots, rooms, replies, likes, and moderation status.",
          "To call supported third-party APIs on demand for OAuth, provider account identity, and metadata refresh where a provider is configured and the feature is used.",
          "To remember device-local choices such as continuing into a profile with Spotify music so the same profile does not need to show the blocking music overlay on every visit.",
          "To comply with applicable legal obligations, respond to valid requests, preserve records when needed, and protect rights and safety.",
        ],
      },
      {
        title: "Integrations and OAuth",
        items: [
          "Supported integration providers may include Spotify, Apple Music, YouTube, Twitch, GitHub, and future providers added to the same constrained model.",
          "Spotify, YouTube, Twitch, and GitHub may use OAuth when configured. Apple Music support in this pass is URL, embed, and developer-token metadata support, not MusicKit user-token authorization.",
          "OAuth access and refresh tokens, when stored, are encrypted server-side using a server-only integration encryption key. Provider client secrets and provider passwords are not stored in your profile and are not sent to the browser.",
          "thia.lol stores the minimum provider account identity and granted scope data needed to show connected state, refresh metadata, disconnect accounts, and troubleshoot errors.",
          "Metadata cache records may store normalized source URLs, provider/resource ids, fetched metadata, generated embed information, freshness/stale timestamps, and last error information so public cards can degrade gracefully.",
          "Provider passwords are never requested or stored by thia.lol. You authorize through the provider's own OAuth page when OAuth is used.",
        ],
      },
      {
        title: "Embeds and third-party loading",
        items: [
          "Inline embeds are generated only for allowlisted providers from normalized provider/resource ids. User-supplied iframe HTML is not stored or rendered.",
          "When an embed is rendered, your browser may connect directly to the provider, such as Spotify, Apple, YouTube, Twitch, or GitHub-linked resources.",
          "Those third parties may receive technical data such as IP address, user agent, page/referrer context, cookies they control, and interaction data according to their own policies.",
          "Profiles with visible Spotify music may show a Continue to profile overlay. Pressing it stores a local per-profile consent record on that browser and may try to start Spotify playback. Stored consent is a thia.lol product choice, not a guarantee that the browser or Spotify will allow autoplay.",
          "If provider metadata refresh fails, thia.lol may show the last good cached card. If no cache exists, it may show a compact outbound link card.",
        ],
      },
      {
        title: "What is public",
        items: [
          "Public posts, replies, reblogs, rooms, profile pages, handles, display names, avatars, banners, backgrounds, badges, follow counts, visible room activity, public modules, rich cards, embeds, and visible integration-derived metadata may be seen by other people.",
          "Public content can be copied or linked by others. Removing it from thia.lol does not guarantee copies elsewhere disappear.",
          "DMs are not public, but they may be processed to deliver the chat feature and may be reviewed if reported, required by law, or needed for safety or security.",
        ],
      },
      {
        title: "Who we share data with",
        items: [
          "Hosting and infrastructure providers that process data for site hosting, file storage, security, and maintenance.",
          "Moderators and admins who need access to review reports, enforce rules, maintain the service, or resolve support requests.",
          "Supported integration providers when you connect an account, resolve metadata, render an embed, or ask thia.lol to refresh provider-backed cards.",
          "Legal, safety, or rights holders when we reasonably believe disclosure is required by law, valid process, urgent safety needs, or rights enforcement.",
          "Other users and the public when you publish public content or interact in visible spaces.",
        ],
      },
      {
        title: "Retention",
        items: [
          "Account, content, message, upload, moderation, and security records are kept for as long as needed to operate the service, maintain safety, comply with law, resolve disputes, and preserve backups.",
          "Some deleted or hidden content may remain in backups, logs, moderation records, report context, or earlier interactions for a limited period or where retention is necessary.",
          "Detailed retention schedules are still deferred and should be reviewed before broader launch.",
        ],
      },
      {
        title: "Your rights and choices",
        items: [
          "You can ask for access to personal data associated with your account.",
          "You can ask to correct inaccurate account or profile data.",
          "You can ask for deletion of your account or specific content, subject to safety, legal, moderation, backup, and technical limits.",
          "You can disconnect OAuth integrations where the feature is available. You may also need to revoke access inside the third-party provider's own account settings.",
          "Where applicable under Norway, EU, UK, or similar privacy rules, you may object to or request restriction of certain processing.",
          "Automated self-service data export is not built yet. You can request a manual export, and a fuller export flow is deferred.",
        ],
      },
      {
        title: "International basics",
        body: "thia.lol may be used from different countries and may rely on providers that process data in more than one region. We aim to handle privacy requests in a Norway/EU/UK/US-aware way without claiming a compliance program that is larger than the current platform.",
      },
      {
        title: "Contact",
        body: `Privacy questions or rights requests can be sent to ${contactEmail}. Include your handle and enough context to find the relevant account or content.`,
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    label: "cookies",
    description:
      "The cookies and local preferences thia.lol uses for sign-in, security, theme, and the cookie notice.",
    updated,
    sections: [
      {
        title: "Current cookie use",
        body: "thia.lol currently uses necessary cookies and local preferences. It does not currently use thia.lol analytics or marketing cookies.",
      },
      {
        title: "Strictly necessary cookies",
        items: [
          "Session cookies keep you signed in and help the service recognize your account securely.",
          "Security cookies or tokens help protect authenticated actions from cross-site request forgery and other session abuse.",
          "These cookies are necessary for accounts, posting, moderation, uploads, messages, and other signed-in features. The cookie notice does not block them.",
        ],
      },
      {
        title: "Local preferences",
        items: [
          "Theme preference may be stored locally so the site can remember Sunveil or Frostveil.",
          "Cookie notice acknowledgement may be stored in your browser so the same notice is not shown every visit.",
          "When you press Continue to profile on a public profile with Spotify music, thia.lol may store a local per-profile record so that profile can open directly next time and try playback without showing the same overlay again.",
          "These preferences are not used for advertising.",
        ],
      },
      {
        title: "Analytics and marketing",
        body: "No thia.lol analytics, advertising, retargeting, or marketing cookies are currently used. If optional analytics are added later, the cookie policy and consent controls should be updated first.",
      },
      {
        title: "Third-party embeds",
        items: [
          "Profile embeds and rich provider cards may load third-party content only after the profile/module renders the provider surface.",
          "Spotify music embeds may already be present on a profile before you press Continue to profile; pressing Continue only controls thia.lol's blocking overlay and playback attempt.",
          "Third-party providers may set or read cookies they control, receive technical request data, or apply their own tracking rules according to their policies.",
          "thia.lol does not control provider cookies. You can use browser privacy controls, provider account controls, or avoid interacting with embeds if you do not want that provider loading.",
        ],
      },
      {
        title: "Managing choices",
        items: [
          "You can clear site data in your browser to remove local preferences and cookies.",
          "If you block necessary cookies, signed-in features may not work.",
          "Use the Legal Contact page if you have questions about cookie behavior.",
        ],
      },
    ],
  },
  "community-guidelines": {
    title: "Community Guidelines",
    label: "guidelines",
    description:
      "The community rules for posts, replies, rooms, profiles, uploads, reports, and DMs on thia.lol.",
    updated,
    sections: [
      {
        title: "The short version",
        body: "Be legal, be honest, respect boundaries, and do not use thia.lol to harm or pressure other people.",
      },
      {
        title: "Be legal",
        items: [
          "Do not post, upload, link to, request, or coordinate illegal content or activity.",
          "Do not use profile modules, rich cards, embeds, creator links, music cards, galleries, or integrations to surface illegal content or evade platform rules.",
          "Do not use the service to evade lawful restrictions, court orders, or platform enforcement.",
        ],
      },
      {
        title: "No harassment or threats",
        items: [
          "Do not threaten, stalk, intimidate, dogpile, or repeatedly target people with unwanted contact.",
          "Criticism and disagreement are allowed. Abuse, threats, and coordinated harassment are not.",
        ],
      },
      {
        title: "No non-consensual sexual content",
        items: [
          "Do not post or share intimate, sexual, or suggestive content involving someone without their consent.",
          "Do not sexualize minors, request sexual content from minors, or share exploitative material.",
        ],
      },
      {
        title: "No doxxing or private information",
        items: [
          "Do not share private addresses, phone numbers, identity documents, financial details, private messages, or other sensitive information without permission.",
          "Do not encourage others to find or expose someone's private information.",
        ],
      },
      {
        title: "No hate content",
        body: "Do not attack, dehumanize, or promote exclusion or violence against people based on protected or vulnerable characteristics such as race, ethnicity, nationality, religion, caste, sex, gender identity, sexual orientation, disability, or similar traits.",
      },
      {
        title: "No spam, scams, or malware",
        items: [
          "Do not flood feeds, manipulate engagement, mass-message people, or create deceptive accounts.",
          "Do not post phishing, malware, fraudulent offers, fake giveaways, or misleading links.",
          "Do not use embedded or external provider content to hide scams, malware, trackers, or deceptive destination changes.",
        ],
      },
      {
        title: "Respect copyright and identity",
        items: [
          "Only post, upload, link, embed, import, or feature content you own or have permission to use.",
          "Do not impersonate another person, brand, moderator, admin, or organization in a misleading way.",
          "Do not make integration cards, creator modules, GitHub projects, playlists, videos, streams, or Apple/Spotify/YouTube/Twitch/GitHub identities look like they belong to you if they do not.",
        ],
      },
      {
        title: "Profiles and external content",
        items: [
          "Profile-level reports may consider public modules, linked content, embedded content, imported metadata, creator modules, music modules, backgrounds, and galleries.",
          "thia.lol can moderate what appears on thia.lol, including removing modules or restricting accounts. It cannot directly moderate or remove content from third-party platforms.",
          "If third-party content violates that provider's rules, you may also need to report it to the provider.",
        ],
      },
      {
        title: "Rooms and DMs",
        items: [
          "Rooms may have extra rules about topic, tone, and posting boundaries.",
          "DMs are covered by the same rules as public spaces, even when the conversation is private.",
        ],
      },
      {
        title: "Reporting and enforcement",
        body: "Use the report tools where available or contact us through the Legal Contact page. Report categories include harassment, hate or abuse, non-consensual content, private information, spam or scam, copyright, threats, self-harm, illegal content, and other rule-breaking behavior. Moderation actions may include removing or hiding content, restricting accounts, suspending accounts, reviewing or dismissing reports, or taking room-level action when those tools exist.",
      },
    ],
  },
  copyright: {
    title: "Copyright and Takedown Policy",
    label: "copyright",
    description:
      "How thia.lol handles copyright concerns, takedown requests, repeat infringement, and manual counter-notice contact.",
    updated,
    sections: [
      {
        title: "Respect creative rights",
        body: "Only post, upload, link, embed, import, or feature content you own, created, licensed, or are otherwise allowed to use. This applies to text, images, videos, profile backgrounds, galleries, rich cards, music cards, creator modules, room media, and anything else you submit or surface.",
      },
      {
        title: "Reporting copyright infringement",
        items: [
          `Send copyright or takedown concerns to ${contactEmail}.`,
          "Include your name or organization, contact email, and a clear description of the copyrighted work.",
          "Include the thia.lol URL or enough detail to identify the allegedly infringing content, including profile module, embed, gallery item, background media, creator card, or linked provider URL if relevant.",
          "Explain why you believe the use is unauthorized.",
          "Confirm that the information in your report is accurate and that you are the rights holder or authorized to act for the rights holder.",
        ],
      },
      {
        title: "What may happen after a report",
        items: [
          "We may remove, hide, restrict, or keep content unavailable while reviewing a rights concern.",
          "We may remove a module, card, background, gallery item, or link from thia.lol while leaving the underlying third-party content untouched because thia.lol does not control third-party platforms.",
          "We may contact the person who posted the content when appropriate.",
          "We may reject incomplete, abusive, or unclear reports.",
        ],
      },
      {
        title: "Repeat infringement",
        body: "Accounts that repeatedly post infringing content may be restricted or suspended. The response depends on the pattern, severity, available information, and applicable law.",
      },
      {
        title: "Counter-notices and disputes",
        body: "There is no automated counter-notice system yet. If your content was removed for copyright reasons and you believe that was a mistake, contact us manually with the content, account, reason, and any rights or permission information you want reviewed.",
      },
      {
        title: "Third-party brand icons",
        body: "Profile connection brand icons are provided through Simple Icons via react-icons. Brand names, logos, and trademarks belong to their respective owners. Their display in profile links does not imply endorsement, sponsorship, or affiliation with thia.lol.",
      },
      {
        title: "International note",
        body: "thia.lol is not treating copyright as a US-only issue. Reports may involve Norwegian, EU, UK, US, or other international copyright rules. This page is a practical takedown contact process, not a guarantee of a specific legal outcome.",
      },
    ],
  },
  moderation: {
    title: "Moderation Policy",
    label: "moderation",
    description:
      "How reports, admin review, enforcement actions, appeals, and transparency basics work on thia.lol.",
    updated,
    sections: [
      {
        title: "Moderation approach",
        body: "thia.lol uses human admin/moderator review for reports and enforcement decisions. The goal is to keep the platform usable and safe without pretending that every issue can be solved instantly or perfectly.",
      },
      {
        title: "Report flow",
        items: [
          "Logged-in users can report posts, replies, profiles, rooms, and chat messages where report tools are available.",
          "Profile reports can include profile modules, rich cards, linked or embedded content, gallery media, creator modules, music modules, image backgrounds, video backgrounds, and integration-derived metadata.",
          "Reports ask for a category and optional context so moderators can compare the issue with the Community Guidelines.",
          "Use the Legal Contact page for sensitive safety, privacy, copyright, or account concerns that need extra context outside the report form.",
        ],
      },
      {
        title: "Review",
        items: [
          "Admins and moderators may review reported content, account context, report details, and relevant public activity.",
          "For external or embedded content, moderators can review how it appears on thia.lol and the linked destination, but third-party services remain responsible for their own hosting and enforcement.",
          "DMs are not treated as public posts, but they may be reviewed when reported, legally required, or needed for safety or security.",
          "Moderators may dismiss a report, mark it reviewed with notes, or take enforcement action.",
        ],
      },
      {
        title: "Possible actions",
        items: [
          "Remove or hide content.",
          "Remove, hide, or disable profile modules, embeds, external links, integration cards, uploaded backgrounds, or gallery items.",
          "Restrict, suspend, or close an account.",
          "Take room moderation actions such as removing content from a room, limiting participation, or enforcing room rules when those tools exist.",
          "Preserve information for safety, legal, or security review.",
        ],
      },
      {
        title: "Appeals",
        body: "A full appeal system is not built yet. If you think a moderation action was wrong, contact us manually with your handle, the affected content or report, the decision you want reviewed, and any context that may change the outcome.",
      },
      {
        title: "Transparency basics",
        items: [
          "Public feeds use simple factors such as recency, follows, moots, rooms, replies, likes, and moderation status. The platform should avoid opaque engagement maximization.",
          "Policy pages explain the rules, report handling, possible actions, contact route, and known limits.",
          "thia.lol is not claiming very-large-platform obligations or advanced automated safety systems. DSA-inspired transparency is used here as a practical baseline.",
        ],
      },
      {
        title: "Safety and legal emergencies",
        body: "If we become aware of urgent safety risks, credible threats, exploitation, or valid legal requests, we may act quickly, preserve information, or contact appropriate services where required or appropriate.",
      },
    ],
  },
};

export function LegalIndexPage() {
  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Legal Contact"
        description="Legal, privacy, safety, copyright, and moderation contact information for thia.lol."
        path="/legal"
      />
      <Panel className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="warm">legal</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
              Legal and trust
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              thia.lol is a social platform for member posts, rooms, and chat. These
              pages explain the rules, privacy basics, copyright contact, and
              moderation process.
            </p>
          </div>
          <BrandLogoMain data-testid="legal-brand-logo-main" size="lg" />
        </div>
        <div className="mt-5 rounded-card border border-line bg-canvas/45 p-4">
          <div className="flex items-start gap-3">
            <Mail aria-hidden="true" className="mt-1 text-muted" size={18} />
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
                for privacy requests, copyright notices, moderation appeals, safety
                concerns, or legal questions. Include relevant handles, links, and
                enough context to find the issue.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                No private address or phone contact is published here. This page is a
                practical contact point, not formal legal advice.
              </p>
            </div>
          </div>
        </div>
      </Panel>
      <PolicyLinkGrid />
    </motion.div>
  );
}

export function LegalContactRedirect() {
  return <Navigate to="/legal" replace />;
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

function PolicyPage({ slug }: { slug: keyof typeof policies }) {
  const policy = policies[slug]!;

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={policy.title}
        description={policy.description}
        path={`/${slug}`}
      />
      <Panel className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="warm">{policy.label}</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
              {policy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {policy.description}
            </p>
            <p className="mt-4 text-sm text-muted">Last updated: {policy.updated}</p>
          </div>
          <BrandMark
            className="order-first shadow-soft sm:order-none"
            data-testid="policy-brand-mark"
            shape="squircle"
            size="lg"
          />
        </div>
      </Panel>

      <Panel className="divide-y divide-line overflow-hidden">
        {policy.sections.map((section) => (
          <section key={section.title} className="p-5 sm:p-6">
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
        ))}
      </Panel>

      <PolicyLinkGrid currentPath={`/${slug}`} />
    </motion.div>
  );
}

function PolicyLinkGrid({ currentPath }: { currentPath?: string }) {
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <FileText aria-hidden="true" size={17} />
        Policy pages
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {policyLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={currentPath === link.to ? "page" : undefined}
            className="group flex min-h-11 items-center justify-between gap-3 rounded-card border border-line bg-canvas/45 px-3 py-2 text-sm font-medium text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:border-line-strong aria-[current=page]:text-text"
          >
            {link.label}
            <ArrowRight
              aria-hidden="true"
              className="transition duration-fluid group-hover:translate-x-0.5"
              size={15}
            />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
