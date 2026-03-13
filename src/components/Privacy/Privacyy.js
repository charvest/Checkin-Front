import { useEffect, useRef, useState } from "react";
import privacyImg from "../../assets/Pri-vacy.png";

// social icons
import facebook from "../../assets/Facebook.png";
import twitter from "../../assets/Twitter.png";
import instagram from "../../assets/Instagram.png";
import linkedin from "../../assets/Linkedin.png";

/* ---------------- Hi everything is okay now ---------------- */
function useInView(options = { threshold: 0.15 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(el);
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return [ref, inView];
}

function FadeBlock({ children, delay = 0 }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Section({ title, children, delay = 0 }) {
  return (
    <FadeBlock delay={delay}>
      <section className="mt-14">
        <h2 className="font-lora font-bold text-[24px] sm:text-[28px] text-[#111]">
          {title}
        </h2>
        <div className="mt-3 h-[2px] w-full bg-black/10 rounded-full" />
        <div className="mt-6 text-[15px] sm:text-[16px] leading-relaxed text-black/80">
          {children}
        </div>
      </section>
    </FadeBlock>
  );
}

export default function Policyy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="relative w-full font-nunito bg-[#FAFAFA] overflow-hidden">
      {/* DOODLE BACKGROUND */}
      <div
        className="
          pointer-events-none absolute inset-0 opacity-[0.08]
          bg-[radial-gradient(circle_at_20%_30%,#000_1px,transparent_1px),
              radial-gradient(circle_at_70%_60%,#000_1px,transparent_1px)]
          bg-[length:48px_48px]
        "
      />
      <div className="pointer-events-none absolute top-24 left-6 text-[42px] opacity-20 rotate-[-12deg]">
        ~~~
      </div>
      <div className="pointer-events-none absolute bottom-40 right-8 text-[36px] opacity-20 rotate-[8deg]">
        ≈≈≈
      </div>

      {/* HEADER ROW */}
      <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 pt-16 sm:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeBlock>
            <h1 className="font-lora font-bold text-[36px] sm:text-[44px] text-[#111]">
              CheckIn’s Privacy Notice
            </h1>

            {/* SOCIAL ICONS */}
            <div className="mt-4 flex gap-4">
              {[facebook, twitter, instagram, linkedin].map((icon, i) => (
                <img
                  key={i}
                  src={icon}
                  alt="social icon"
                  className="w-[34px] h-[34px] object-contain opacity-80 hover:opacity-100 transition"
                />
              ))}
            </div>

            <p className="mt-6 text-[15px] sm:text-[17px] text-black/75 max-w-[60ch]">
              CheckIn is committed to protecting the privacy, confidentiality, and security of
              personal and sensitive information in accordance with the Data Privacy Act of 2012
              (Republic Act No. 10173).
            </p>

            <p className="mt-4 text-[15px] sm:text-[17px] text-black/75 max-w-[60ch]">
              This Privacy Policy explains how CheckIn collects, uses, stores, protects, and manages
              personal data obtained through its web-based student mental wellness platform.
            </p>
          </FadeBlock>

          <FadeBlock delay={120}>
            <img
              src={privacyImg}
              alt="Privacy illustration"
              className="w-full h-auto object-contain select-none"
              draggable="false"
            />
          </FadeBlock>
        </div>
      </div>

      {/* POLICY CONTENT */}
      <div className="relative mx-auto max-w-[1100px] px-5 sm:px-8 lg:px-10 py-16 sm:py-20">
        <Section title="1. Information We Collect" delay={80}>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>Account Information:</strong> Name, email address, role, and login credentials
              required to create and manage user accounts.
            </li>
            <li>
              <strong>Self-Assessment Data:</strong> PHQ-9 responses and results used to support early
              awareness and personal reflection.
            </li>
            <li>
              <strong>Journal Content (Optional):</strong> Personal entries voluntarily created
              within the application. These entries are private by default and accessible only to
              the user unless explicitly shared.
            </li>
            <li>
              <strong>Guidance and Support Requests:</strong> Information submitted when requesting
              assistance from guidance counselors or administrators.
            </li>
            <li>
              <strong>Technical Information:</strong> Device type, browser information, and usage
              logs collected for system performance and security.
            </li>
          </ul>
        </Section>

        <Section title="2. Purpose of Data Collection">
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and maintain CheckIn features and services</li>
            <li>Support journaling, assessments, and guidance workflows</li>
            <li>Promote early awareness and mental wellness support</li>
            <li>Improve system usability, accessibility, and reliability</li>
            <li>Ensure platform security and prevent misuse</li>
            <li>Comply with legal and institutional obligations</li>
          </ul>
        </Section>

        <Section title="3. Legal Basis for Processing">
          <p>
            Personal data is processed based on user consent, legitimate institutional interest,
            compliance with legal obligations, and the provision of mental wellness support services
            consistent with RA 10173.
          </p>
        </Section>

        <Section title="4. Data Sharing and Disclosure">
          <p>
            CheckIn does not sell personal data. Information may only be disclosed to authorized
            personnel, service providers bound by confidentiality agreements, or when required by
            law or necessary to protect user safety.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            Personal data is retained only for as long as necessary to fulfill its intended purpose
            or as required by institutional or legal requirements. Users may request data deletion
            subject to applicable policies.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            CheckIn implements reasonable administrative, technical, and organizational safeguards
            to protect personal information against unauthorized access, loss, or misuse.
          </p>
        </Section>

        <Section title="7. User Rights">
          <p>
            In accordance with RA 10173, users have the right to access, correct, object to, or
            request deletion of their personal data, subject to lawful limitations.
          </p>
        </Section>

        <Section title="8. Limitations and Disclaimer">
          <p>
            CheckIn is not a diagnostic or medical tool and does not replace professional mental
            health services. Users experiencing severe distress should seek immediate professional
            or emergency assistance.
          </p>
        </Section>

        <Section title="9. Policy Updates">
          <p>
            This Privacy Policy may be updated from time to time. Continued use of the platform
            constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="10. Contact Information">
          <p>
            For privacy-related concerns, questions, or data requests, users may contact the
            institution or system administrator responsible for the CheckIn platform.
          </p>
        </Section>
      </div>
    </main>
  );
}
