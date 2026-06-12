"use client";

import Image from "next/image";
import { useEffect, Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import Loader from "../../components/Loader";
import Modal from "../../components/Modal";

const getDefaultRoute = (role: string | string[] | null | undefined) => {
  if (!role) return "/";
  if (Array.isArray(role)) {
    return role.includes("hospitalAdmin") ? "/hospital-admin" : "/";
  }
  return role.includes("hospitalAdmin") ? "/hospital-admin" : "/";
};

function AuthContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const defaultRoute = useMemo(
    () => getDefaultRoute(user?.role ?? null),
    [user?.role]
  );

  // Magic link handling is now done globally by MagicLinkHandler component
  // This ensures it works from any page, not just auth pages

  // Handle password recovery flow
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes("#access_token=") && hash.includes("&type=recovery")) {
        // Only redirect if we're not already on the reset password page
        if (pathname !== '/forgot-reset-password') {
          setIsRedirecting(true);
          // Redirect to reset password page with the hash intact
          router.replace(`/forgot-reset-password${hash}`);
        }
      }
    }
  }, [router, pathname]);

  // Reset redirecting state when we reach the reset password page
  useEffect(() => {
    if (pathname === '/forgot-reset-password') {
      setIsRedirecting(false);
    }
  }, [pathname]);

  // If an already-authenticated user lands on /login or /signup, redirect them away.
  // Prefer the ?redirect=<url> param if present (used by middleware / external apps),
  // or magic link redirect from sessionStorage, otherwise fall back to the default dashboard route.
  useEffect(() => {
    if (pathname !== '/login' && pathname !== '/signup') return;
    if (isLoading) return;
    if (!isAuthenticated) return;

    setIsRedirecting(true);

    try {
      // Check for magic link redirect first (from sessionStorage)
      const magicLinkRedirect = typeof window !== 'undefined' 
        ? sessionStorage.getItem('magic_link_redirect')
        : null;
      
      if (magicLinkRedirect) {
        sessionStorage.removeItem('magic_link_redirect');
        if (magicLinkRedirect.startsWith('http://') || magicLinkRedirect.startsWith('https://')) {
          window.location.href = magicLinkRedirect;
        } else {
          router.replace(magicLinkRedirect);
        }
        return;
      }

      // Check for redirect query param
      const redirectParam = searchParams.get('redirect');
      if (!redirectParam) {
        router.replace(defaultRoute);
        return;
      }

      const rawRedirect = redirectParam;

      if (rawRedirect.startsWith('http://') || rawRedirect.startsWith('https://')) {
        if (typeof window !== 'undefined') {
          window.location.href = rawRedirect;
        }
      } else if (rawRedirect.startsWith('/')) {
        router.replace(rawRedirect);
      } else {
        router.replace(defaultRoute);
      }
    } catch (error) {
      console.error('Failed to handle redirect param on /login for authenticated user:', error);
      router.replace(defaultRoute);
    }
  }, [pathname, isAuthenticated, isLoading, searchParams, router, defaultRoute]);

  // Show loader for various states
  if (
    isRedirecting ||
    ((pathname === '/login' || pathname === '/signup') && isLoading) ||
    ((pathname === '/login' || pathname === '/signup') && isAuthenticated)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FF]">
        <Loader size="large" />
      </div>
    );
  }

  // Callback page gets minimal layout (no background/footer)
  if (pathname === '/callback') {
    return (
      <div className="min-h-screen bg-[#F5F8FF]">
        <div className="absolute top-4 left-0">
          <Image src="/images/dash.png" alt="Logo" width={120} height={32} className="h-8 w-auto px-6" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="relative min-h-screen bg-[#F5F8FF]">
        <div className="absolute inset-0 top-0 z-0 h-[45vh] md:bottom-0 md:top-auto md:h-[calc(100dvh-25dvh)]">
          <Image
            src="/images/mobile.png"
            alt="Background"
            fill
            sizes="100vw"
            className="object-cover object-top opacity-90 md:hidden md:object-contain"
            priority
          />
          <Image
            src="/images/background.png"
            alt="Background"
            fill
            sizes="100vw"
            className="hidden object-cover opacity-90 md:block lg:object-cover"
            priority
          />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20 md:items-start">
          {children}
        </div>
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-6 md:px-20"
        style={{
          background:
            "linear-gradient(180deg, rgba(179, 196, 204, 0) 0%, #B1C2CA 100%)",
        }}
      >
        <p className="text-center text-xs text-[#282C368A] md:text-sm">
          © Copyright 2025 <a href="https://www.nurmed.ai/">Nurmed.ai</a>
        </p>
        <p 
          className="hidden cursor-pointer text-center text-xs text-[#282C368A] hover:underline md:block md:text-sm"
          onClick={() => setShowTermsModal(true)}
        >
          Term & Condition & Privacy Policy{" "}
        </p>
        <p 
          className="cursor-pointer text-center text-[10px] text-[#282C368A] hover:underline md:hidden"
          onClick={() => setShowTermsModal(true)}
        >
          Terms & Privacy
        </p>
      </div>
      </div>

      {showTermsModal && (
        <Modal 
          onClose={() => setShowTermsModal(false)}
          className="flex max-h-[90vh] w-full flex-col bg-white sm:rounded-lg"
        >
          {/* Fixed Header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Terms of Use</h2>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-medium">Nurmed AI LLC</span> • Last Updated: 17 December 2025
              </p>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="prose max-w-none text-sm text-gray-700">

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">1. Definitions</h3>
              <p className="mb-3 text-gray-700">For the purposes of this Agreement:</p>
              <ul className="ml-6 list-disc space-y-2.5 text-gray-700">
                <li><strong>"Company"</strong> means Nurmed AI LLC, a limited liability company registered in the Meydan Free Zone, Dubai, United Arab Emirates, trading as "Nurmed AI."</li>
                <li><strong>"User"</strong> means any individual accessing or using the Services, including licensed healthcare professionals authorized by a healthcare organization.</li>
                <li><strong>"Healthcare Provider"</strong> or <strong>"Controller"</strong> means the hospital, clinic, or medical institution that authorizes the User's access and determines the purposes and means of processing Personal Data.</li>
                <li><strong>"Services"</strong> means the Nurmed AI software platform, mobile application, website, associated features, AI-generated outputs, and related technologies provided by the Company.</li>
                <li><strong>"AI Output"</strong> means any transcription, draft note, summary, suggestion, translation, or system-generated text produced by the Services.</li>
                <li><strong>"Personal Data"</strong> has the meaning assigned under applicable data protection legislation, including UAE Federal Decree-Law No. 45 of 2021, DIFC Data Protection Law, GDPR-equivalent laws, and other applicable regulations.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">2. Nature of the Services</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">2.1</span> The Services provide AI-assisted tools intended solely to support clinical documentation, transcription, translation, summarization, and workflow facilitation for healthcare professionals.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">2.2</span> The Services do not constitute medical advice, diagnosis, treatment, or clinical decision-making. The Services are not a medical device and are not certified under any medical device regulatory scheme.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">2.3</span> The Services are provided exclusively as an assistive technology. All clinical interpretation, judgment, and final decision-making remain the sole responsibility of the User and the Healthcare Provider.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">3. Role of the Parties</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">3.1</span> The Healthcare Provider is, at all times, the Data Controller. The Company acts solely as a Data Processor on behalf of the Healthcare Provider.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">3.2</span> The Company processes Personal Data only upon documented instructions from the Healthcare Provider and for the limited purposes of providing the Services.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">3.3</span> The Healthcare Provider is solely responsible for ensuring that any Personal Data input into the Services, including patient information, is collected and processed lawfully.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">4. Eligibility and Authorization</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">4.1</span> The User represents and warrants that they are a licensed healthcare professional or an individual otherwise authorized by the Healthcare Provider to access the Services.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">4.2</span> User access is contingent upon continued authorization by the Healthcare Provider. The User must immediately cease use of the Services upon termination of employment, revocation of privileges, or withdrawal of authorization.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">5. Clinical Responsibility and Use of AI Output</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">5.1</span> All AI Output generated by the Services constitutes preliminary, unverified draft text and may contain errors, omissions, or inaccuracies.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">5.2</span> The User acknowledges and agrees that they are solely responsible for reviewing, verifying, editing, and approving all AI Output prior to its incorporation into any medical record or clinical workflow.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">5.3</span> Neither the Company nor the Services assume any responsibility for:
                </p>
                <ul className="ml-8 list-disc space-y-2 text-gray-700">
                  <li>(a) clinical decisions;</li>
                  <li>(b) diagnoses;</li>
                  <li>(c) treatment plans;</li>
                  <li>(d) patient outcomes; or</li>
                  <li>(e) any reliance upon AI Output by the User.</li>
                </ul>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">5.4</span> AI Output must not be used as the basis for direct patient care without independent professional verification.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">6. Data Processing and International Transfers</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">6.1</span> The User and Healthcare Provider acknowledge and authorize the Company to process data—including audio recordings, transcriptions, text inputs, metadata, and associated content—through secure cloud infrastructure.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">6.2</span> Personal Data may be processed or stored in data centers located in the United Arab Emirates, the European Union, the United States, the Middle East, Africa, or South Asia, subject to adequate safeguards.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">6.3</span> Authorized sub-processors may include, without limitation, cloud hosting providers (such as AWS, Microsoft Azure, and Google Cloud) and AI model providers (including OpenAI and other approved service vendors).
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">6.4</span> The Company implements industry-standard security controls, encryption, and access limitations appropriate for the processing of sensitive information.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">7. User Obligations</h3>
              <p className="mb-3 text-gray-700">The User shall:</p>
              <ul className="ml-6 list-disc space-y-2.5 text-gray-700">
                <li><span className="font-semibold text-gray-900">7.1</span> Use the Services only within the scope of their professional authorization and in accordance with applicable laws, regulations, and institutional policies.</li>
                <li><span className="font-semibold text-gray-900">7.2</span> Ensure that all data input into the Services is accurate and compliant with applicable data protection and confidentiality requirements.</li>
                <li><span className="font-semibold text-gray-900">7.3</span> Maintain the confidentiality of login credentials and prevent unauthorized access.</li>
                <li><span className="font-semibold text-gray-900">7.4</span> Not upload unlawful, harmful, or unauthorized content.</li>
                <li><span className="font-semibold text-gray-900">7.5</span> Not use the Services to diagnose, treat, or prescribe.</li>
                <li><span className="font-semibold text-gray-900">7.6</span> Not rely upon the Services as a substitute for professional judgment.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">8. Prohibited Conduct</h3>
              <p className="mb-3 text-gray-700">The User shall not:</p>
              <ul className="ml-6 list-disc space-y-2.5 text-gray-700">
                <li><span className="font-semibold text-gray-900">8.1</span> Copy, reproduce, distribute, modify, or create derivative works of the Services.</li>
                <li><span className="font-semibold text-gray-900">8.2</span> Reverse engineer, decompile, or otherwise attempt to extract source code, models, algorithms, or proprietary components.</li>
                <li><span className="font-semibold text-gray-900">8.3</span> Use AI Output to develop, train, or enhance any competing technology or artificial intelligence system.</li>
                <li><span className="font-semibold text-gray-900">8.4</span> Circumvent, disable, or interfere with security features or access controls.</li>
                <li><span className="font-semibold text-gray-900">8.5</span> Export Personal Data from the Services into non-compliant or unapproved tools.</li>
                <li><span className="font-semibold text-gray-900">8.6</span> Use the Services for any purpose that could reasonably be expected to cause harm to patients, the Healthcare Provider, the Company, or any third party.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">9. Intellectual Property</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">9.1</span> All rights, title, and interest in and to the Services—including all software, architecture, algorithms, models, prompts, workflows, user interfaces, documentation, and related intellectual property—remain the exclusive property of the Company.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">9.2</span> Nothing in these Terms grants the User or Healthcare Provider any right of ownership. Only a limited, revocable, non-exclusive license to access and use the Services is provided.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">10. Security</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">10.1</span> The Company employs technical and organizational measures to protect Personal Data in accordance with applicable law.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">10.2</span> The User shall comply with the Healthcare Provider's security standards and safeguard access credentials.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">10.3</span> The Company shall not be liable for security incidents arising from User negligence, credential sharing, unauthorized access, or institutional misuse.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">11. Availability of Services</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">11.1</span> The Company does not guarantee uninterrupted or error-free operation.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">11.2</span> Maintenance, updates, outages of third-party providers, or network interruptions may affect availability.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">12. Limitation of Liability</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">12.1</span> To the maximum extent permitted by law, the Company shall not be liable for any indirect, incidental, special, exemplary, punitive, or consequential damages.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">12.2</span> The Company shall not be liable for any clinical decisions, medical outcomes, or patient-related consequences arising from the use or misuse of the Services or AI Output.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">12.3</span> The Company's aggregate liability for any claim under these Terms shall not exceed the lesser of:
                </p>
                <ul className="ml-8 list-disc space-y-2 text-gray-700">
                  <li>(a) United States Dollars Five Hundred (USD 500); or</li>
                  <li>(b) the total amount of fees paid by the Healthcare Provider to the Company in the six-month period preceding the event giving rise to the claim.</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">13. Indemnification</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">13.1</span> The User and Healthcare Provider shall indemnify, defend, and hold harmless the Company from all claims, liabilities, damages, losses, and expenses arising out of:
                </p>
                <ul className="ml-8 list-disc space-y-2 text-gray-700">
                  <li>(a) misuse of the Services;</li>
                  <li>(b) clinical errors or decisions;</li>
                  <li>(c) violations of law;</li>
                  <li>(d) breach of these Terms; or</li>
                  <li>(e) unauthorized use of Personal Data.</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">14. Termination</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">14.1</span> The Company may suspend or terminate a User's access immediately if:
                </p>
                <ul className="ml-8 list-disc space-y-2 text-gray-700">
                  <li>(a) required by the Healthcare Provider;</li>
                  <li>(b) the User breaches these Terms;</li>
                  <li>(c) the User's authorization is revoked; or</li>
                  <li>(d) continued access would pose a security, legal, or operational risk.</li>
                </ul>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">14.2</span> Upon termination, the User must cease all use of the Services.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">15. International Use</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">15.1</span> The Services may be accessed in multiple jurisdictions, including the United Arab Emirates, the Middle East, Europe, Africa, and South Asia.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">15.2</span> The Company does not warrant that the Services are appropriate, lawful, or compliant for use in every jurisdiction. Users are responsible for ensuring compliance with local laws.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">16. Governing Law and Jurisdiction</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">16.1</span> For Users located within the United Arab Emirates (excluding the DIFC), these Terms shall be governed by and construed in accordance with the laws of the United Arab Emirates. The courts of the United Arab Emirates shall have exclusive jurisdiction.
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">16.2</span> For Users located outside the United Arab Emirates, these Terms shall be governed by the laws of the Dubai International Financial Centre. Any dispute shall be subject to the exclusive jurisdiction of the DIFC Courts.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">17. Amendments</h3>
              <div className="space-y-3">
                <p className="text-gray-700">
                  <span className="font-semibold text-gray-900">17.1</span> The Company may amend or update these Terms from time to time. Continued use of the Services constitutes acceptance of the amended Terms.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-6 text-xl font-semibold text-gray-900">18. Contact</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <svg
                        className="h-5 w-5 text-blue-600"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Nurmed AI LLC</p>
                      <p className="mt-1 text-sm text-gray-600">Meydan Free Zone, Dubai, United Arab Emirates</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <a
                        href="mailto:legal@nurmed.ai"
                        className="mt-1 block text-base font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                      >
                        legal@nurmed.ai
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                      <svg
                        className="h-5 w-5 text-purple-600"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Website</p>
                      <a
                        href="https://www.nurmed.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-base font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                      >
                        www.nurmed.ai
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FF]">
        <Loader size="large" />
      </div>
    }>
      <AuthContent>{children}</AuthContent>
    </Suspense>
  );
}
