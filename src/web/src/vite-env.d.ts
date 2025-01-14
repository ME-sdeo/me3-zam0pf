/// <reference types="vite/client" /> // version ^4.4.0

interface ImportMetaEnv extends Vite.ImportMetaEnv {
  /**
   * Base URL for MyElixir API endpoints
   * @example "https://api.myelixir.com"
   */
  readonly VITE_API_BASE_URL: string;

  /**
   * API version identifier
   * @example "v1"
   */
  readonly VITE_API_VERSION: string;

  /**
   * API request timeout in milliseconds
   * @example 30000
   */
  readonly VITE_API_TIMEOUT: number;

  /**
   * Azure AD B2C tenant identifier for authentication
   * @security sensitive
   */
  readonly VITE_AZURE_AD_B2C_TENANT_ID: string;

  /**
   * Azure AD B2C client application ID
   * @security sensitive
   */
  readonly VITE_AZURE_AD_B2C_CLIENT_ID: string;

  /**
   * Azure AD B2C authority URL
   * @security sensitive
   * @example "https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}"
   */
  readonly VITE_AZURE_AD_B2C_AUTHORITY: string;

  /**
   * Medplum FHIR server API endpoint
   * @example "https://api.medplum.com/fhir/R4"
   */
  readonly VITE_MEDPLUM_API_URL: string;

  /**
   * Medplum client application identifier
   * @security sensitive
   */
  readonly VITE_MEDPLUM_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ensure TypeScript compiler enforces all environment variables are defined
declare module '*.env' {
  const content: ImportMetaEnv;
  export default content;
}