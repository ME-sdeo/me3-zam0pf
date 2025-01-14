import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FHIRUploader } from '../../../../src/components/fhir/FHIRUploader';
import { FHIRService } from '../../../../src/services/fhir.service';
import { ValidationSeverity, FHIRValidationErrorType } from '../../../interfaces/fhir.interface';
import { FHIR_VALIDATION } from '../../../constants/validation.constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock FHIRService
jest.mock('../../../../src/services/fhir.service');

describe('FHIRUploader Component', () => {
  // Test data
  const validFHIRResource = {
    resourceType: 'Patient',
    id: 'test-patient',
    meta: {
      versionId: '1',
      lastUpdated: '2023-05-15T00:00:00Z'
    },
    name: [{
      use: 'official',
      family: 'Test',
      given: ['Patient']
    }]
  };

  const mockCallbacks = {
    onUploadComplete: jest.fn(),
    onUploadError: jest.fn(),
    onValidationError: jest.fn(),
    onAuditEvent: jest.fn()
  };

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock FileReader API
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsText: jest.fn(),
      onload: jest.fn(),
      onerror: jest.fn(),
      result: JSON.stringify(validFHIRResource)
    }));

    // Mock FHIRService methods
    (FHIRService as jest.Mock).mockImplementation(() => ({
      validateResource: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      uploadResource: jest.fn().mockResolvedValue(validFHIRResource),
      checkHIPAACompliance: jest.fn().mockResolvedValue({ compliant: true })
    }));
  });

  // Cleanup after each test
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders upload component with accessibility features', async () => {
    const { container } = render(
      <FHIRUploader {...mockCallbacks} />
    );

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify presence of key elements
    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'FHIR Resource Upload');
    expect(screen.getByText(/Drop FHIR resource files here/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FHIR_VALIDATION.ALLOWED_FILE_TYPES.join(', ')))).toBeInTheDocument();
  });

  it('handles file selection and validates FHIR resources', async () => {
    render(<FHIRUploader {...mockCallbacks} />);

    const file = new File(
      [JSON.stringify(validFHIRResource)],
      'test-patient.json',
      { type: 'application/json' }
    );

    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(FHIRService.prototype.validateResource).toHaveBeenCalledWith(validFHIRResource);
      expect(mockCallbacks.onAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FHIR_UPLOAD_INITIATED',
          fileName: 'test-patient.json'
        })
      );
    });
  });

  it('displays validation errors appropriately', async () => {
    const validationError = {
      type: FHIRValidationErrorType.Required,
      field: 'name',
      message: 'Missing required field',
      code: 'MISSING_REQUIRED_FIELD',
      severity: ValidationSeverity.Error,
      path: ['name'],
      context: {}
    };

    (FHIRService.prototype.validateResource as jest.Mock).mockResolvedValueOnce({
      valid: false,
      errors: [validationError]
    });

    render(<FHIRUploader {...mockCallbacks} />);

    const file = new File(
      [JSON.stringify({ resourceType: 'Patient' })],
      'invalid-patient.json',
      { type: 'application/json' }
    );

    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Missing required field/i)).toBeInTheDocument();
      expect(mockCallbacks.onValidationError).toHaveBeenCalledWith([validationError]);
    });
  });

  it('tracks upload progress correctly', async () => {
    render(<FHIRUploader {...mockCallbacks} />);

    const file = new File(
      [JSON.stringify(validFHIRResource)],
      'test-patient.json',
      { type: 'application/json' }
    );

    // Simulate file upload with progress
    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Processing FHIR resource/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockCallbacks.onUploadComplete).toHaveBeenCalledWith(validFHIRResource);
    });
  });

  it('handles upload errors with retry mechanism', async () => {
    const uploadError = new Error('Upload failed');
    (FHIRService.prototype.uploadResource as jest.Mock)
      .mockRejectedValueOnce(uploadError)
      .mockResolvedValueOnce(validFHIRResource);

    render(<FHIRUploader {...mockCallbacks} retryAttempts={2} />);

    const file = new File(
      [JSON.stringify(validFHIRResource)],
      'test-patient.json',
      { type: 'application/json' }
    );

    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(FHIRService.prototype.uploadResource).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.onUploadComplete).toHaveBeenCalledWith(validFHIRResource);
    });
  });

  it('enforces file type restrictions', async () => {
    render(<FHIRUploader {...mockCallbacks} />);

    const invalidFile = new File(
      ['invalid'],
      'test.txt',
      { type: 'text/plain' }
    );

    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(mockCallbacks.onUploadError).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });
  });

  it('handles drag and drop interactions', async () => {
    const { container } = render(<FHIRUploader {...mockCallbacks} />);
    
    // Simulate drag events
    fireEvent.dragEnter(container.firstChild as Element);
    expect(container.firstChild).toHaveStyle({ borderColor: expect.any(String) });

    fireEvent.dragLeave(container.firstChild as Element);
    expect(container.firstChild).not.toHaveStyle({ borderColor: expect.any(String) });
  });

  it('respects disabled state', () => {
    render(<FHIRUploader {...mockCallbacks} disabled={true} />);
    
    const dropzone = screen.getByRole('button');
    expect(dropzone).toHaveAttribute('aria-disabled', 'true');
    expect(dropzone).toHaveStyle({ opacity: '0.5' });
  });

  it('maintains HIPAA compliance in file handling', async () => {
    render(<FHIRUploader {...mockCallbacks} />);

    const file = new File(
      [JSON.stringify(validFHIRResource)],
      'test-patient.json',
      { type: 'application/json' }
    );

    const fileInput = screen.getByLabelText(/Drop FHIR resource files here/i);
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockCallbacks.onAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FHIR_UPLOAD_INITIATED'
        })
      );
      expect(mockCallbacks.onAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FHIR_UPLOAD_SUCCESS'
        })
      );
    });
  });
});