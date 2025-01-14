import React from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_ROUTES } from '../../constants/routes.constants';

/**
 * Global footer component for MyElixir healthcare data marketplace
 * Implements Material Design 3.0 principles with WCAG 2.1 Level AA compliance
 * @returns {JSX.Element} Footer component with navigation and copyright
 */
const Footer: React.FC = () => {
  /**
   * Returns current year for copyright text
   * @returns {number} Current year
   */
  const getCurrentYear = (): number => {
    return new Date().getFullYear();
  };

  return (
    <footer 
      className="footer" 
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="footer__content">
        <nav 
          className="footer__navigation" 
          aria-label="Footer navigation"
        >
          <div className="footer__section">
            <h2 className="footer__heading">Platform</h2>
            <ul className="footer__links">
              <li>
                <Link 
                  to="/" 
                  className="footer__link"
                  aria-label="Go to home page"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  to={PUBLIC_ROUTES.LOGIN} 
                  className="footer__link"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link 
                  to={PUBLIC_ROUTES.REGISTER} 
                  className="footer__link"
                  aria-label="Create a new account"
                >
                  Register
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer__section">
            <h2 className="footer__heading">Resources</h2>
            <ul className="footer__links">
              <li>
                <Link 
                  to="/about" 
                  className="footer__link"
                  aria-label="Learn more about MyElixir"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link 
                  to="/faq" 
                  className="footer__link"
                  aria-label="View frequently asked questions"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  className="footer__link"
                  aria-label="Contact our support team"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer__section">
            <h2 className="footer__heading">Legal</h2>
            <ul className="footer__links">
              <li>
                <Link 
                  to="/privacy" 
                  className="footer__link"
                  aria-label="View privacy policy"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="footer__link"
                  aria-label="View terms of service"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/compliance" 
                  className="footer__link"
                  aria-label="View compliance information"
                >
                  Compliance
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="footer__bottom">
          <p className="footer__copyright">
            © {getCurrentYear()} MyElixir. All rights reserved.
          </p>
          <p className="footer__compliance">
            HIPAA and GDPR Compliant Healthcare Data Marketplace
          </p>
        </div>
      </div>

      <style jsx>{`
        .footer {
          background-color: var(--md-sys-color-surface);
          color: var(--md-sys-color-on-surface);
          padding: 3rem 1.5rem;
          width: 100%;
        }

        .footer__content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer__navigation {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .footer__heading {
          font-size: 1rem;
          font-weight: 500;
          margin-bottom: 1rem;
          color: var(--md-sys-color-primary);
        }

        .footer__links {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .footer__link {
          color: var(--md-sys-color-on-surface-variant);
          text-decoration: none;
          padding: 0.5rem 0;
          display: inline-block;
          transition: color 0.2s ease;
        }

        .footer__link:hover,
        .footer__link:focus {
          color: var(--md-sys-color-primary);
          text-decoration: underline;
          outline: none;
        }

        .footer__link:focus-visible {
          outline: 2px solid var(--md-sys-color-primary);
          outline-offset: 2px;
          border-radius: 2px;
        }

        .footer__bottom {
          border-top: 1px solid var(--md-sys-color-outline-variant);
          padding-top: 2rem;
          text-align: center;
        }

        .footer__copyright,
        .footer__compliance {
          margin: 0.5rem 0;
          font-size: 0.875rem;
          color: var(--md-sys-color-on-surface-variant);
        }

        @media (max-width: 768px) {
          .footer {
            padding: 2rem 1rem;
          }

          .footer__navigation {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .footer__section {
            text-align: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .footer__link {
            transition: none;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;