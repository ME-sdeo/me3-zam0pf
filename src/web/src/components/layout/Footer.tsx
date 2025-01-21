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
      style={styles.footer}
    >
      <div style={styles.footerContent}>
        <nav 
          style={styles.footerNavigation}
          aria-label="Footer navigation"
        >
          <div style={styles.footerSection}>
            <h2 style={styles.footerHeading}>Platform</h2>
            <ul style={styles.footerLinks}>
              <li>
                <Link 
                  to="/" 
                  style={styles.footerLink}
                  aria-label="Go to home page"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  to={PUBLIC_ROUTES.LOGIN} 
                  style={styles.footerLink}
                  aria-label="Sign in to your account"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link 
                  to={PUBLIC_ROUTES.REGISTER} 
                  style={styles.footerLink}
                  aria-label="Create a new account"
                >
                  Register
                </Link>
              </li>
            </ul>
          </div>

          <div style={styles.footerSection}>
            <h2 style={styles.footerHeading}>Resources</h2>
            <ul style={styles.footerLinks}>
              <li>
                <Link 
                  to="/about" 
                  style={styles.footerLink}
                  aria-label="Learn more about MyElixir"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link 
                  to="/faq" 
                  style={styles.footerLink}
                  aria-label="View frequently asked questions"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  style={styles.footerLink}
                  aria-label="Contact our support team"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div style={styles.footerSection}>
            <h2 style={styles.footerHeading}>Legal</h2>
            <ul style={styles.footerLinks}>
              <li>
                <Link 
                  to="/privacy" 
                  style={styles.footerLink}
                  aria-label="View privacy policy"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  style={styles.footerLink}
                  aria-label="View terms of service"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/compliance" 
                  style={styles.footerLink}
                  aria-label="View compliance information"
                >
                  Compliance
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div style={styles.footerBottom}>
          <p style={styles.footerText}>
            © {getCurrentYear()} MyElixir. All rights reserved.
          </p>
          <p style={styles.footerText}>
            HIPAA and GDPR Compliant Healthcare Data Marketplace
          </p>
        </div>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: 'var(--md-sys-color-surface)',
    color: 'var(--md-sys-color-on-surface)',
    padding: '3rem 1.5rem',
    width: '100%',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  footerNavigation: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '2rem',
    marginBottom: '3rem',
  },
  footerSection: {
    '@media (max-width: 768px)': {
      textAlign: 'center',
    },
  },
  footerHeading: {
    fontSize: '1rem',
    fontWeight: 500,
    marginBottom: '1rem',
    color: 'var(--md-sys-color-primary)',
  },
  footerLinks: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  footerLink: {
    color: 'var(--md-sys-color-on-surface-variant)',
    textDecoration: 'none',
    padding: '0.5rem 0',
    display: 'inline-block',
    ':hover': {
      color: 'var(--md-sys-color-primary)',
      textDecoration: 'underline',
    },
    ':focus': {
      color: 'var(--md-sys-color-primary)',
      textDecoration: 'underline',
      outline: 'none',
    },
    ':focus-visible': {
      outline: '2px solid var(--md-sys-color-primary)',
      outlineOffset: '2px',
      borderRadius: '2px',
    },
  },
  footerBottom: {
    borderTop: '1px solid var(--md-sys-color-outline-variant)',
    paddingTop: '2rem',
    textAlign: 'center' as const,
  },
  footerText: {
    margin: '0.5rem 0',
    fontSize: '0.875rem',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
} as const;

export default Footer;