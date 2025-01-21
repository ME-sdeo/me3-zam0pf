import React, { useState, useCallback, useRef } from 'react';
import { Box, Typography, CircularProgress, Alert, AlertTitle } from '@mui/material';
import { Resource } from '@medplum/fhirtypes';

import { FileUpload } from '../common/FileUpload';
import { IFHIRResource, IFHIRValidationError, ValidationSeverity } from '../../interfaces/fhir.interface';
import { FHIRService } from '../../services/fhir.service';
import { FHIR_VALIDATION } from '../../constants/validation.constants';
import apiService from '../../services/api.service';

/**
 * Props interface for the FHIRUploader component
 */
interface FHIRUploaderProps {
  onUploadComplete: (resource: IFHIRResource) => void;
  onUploadError: (error: Error) => void;
  onValidationError: (errors: IFHIRValidationError[]) => void;
  onAuditEvent: (event: any) => void;
  resourceType?: string;
  maxFileSize?: number;
  className?: string;
  disabled?: boolean;
  allowedMimeTypes?: string[];
  validationTimeout?: number;
  retryAttempts?: number;
  accessibilityLabels?: Record<string, string>;
}

/**
 * A secure, HIPAA-compliant FHIR resource uploader component
 * Implements comprehensive validation, accessibility, and audit logging
 */
export const FHIRUploader: React.FC<FHIRUploaderProps> = ({
  onUploadComplete,
  onUploadError,
  onValidationError,
  onAuditEvent,
  resourceType,
  maxFileSize = FHIR_VALIDATION.MAX_RESOURCE_SIZE,
  className,
  disabled = false,
  allowedMimeTypes = FHIR_VALIDATION.ALLOWED_FILE_TYPES,
  validationTimeout = 30000,
  retryAttempts = 3,
  accessibilityLabels = {
    dropzone: 'Drop FHIR resource files here or click to select',
    uploading: 'Uploading and validating FHIR resource',
    error: 'Error uploading FHIR resource'
  }
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<IFHIRValidationError[]>([]);
  
  const fhirService = useRef(new FHIRService(apiService));

  /**
   * Handles file selection with comprehensive validation and security checks
   */
  const handleFileSelect = useCallback(async (file: File) => {
    setIsUploading(true);
    setValidationErrors([]);
    let uploadAttempts = 0;

    try {
      // Log audit event for file selection
      onAuditEvent({
        type: 'FHIR_UPLOAD_INITIATED',
        fileName: file.name,
        fileSize: file.size,
        timestamp: new Date().toISOString()
      });

      // Read file content with timeout protection
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const timeout = setTimeout(() => {
          reader.abort();
          reject(new Error('File read timeout'));
        }, validationTimeout);

        reader.onload = () => {
          clearTimeout(timeout);
          resolve(reader.result as string);
        };

        reader.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('File read error'));
        };

        reader.readAsText(file);
      });

      // Parse and validate FHIR resource
      const resource = JSON.parse(fileContent) as Resource;
      
      // Validate resource type if specified
      if (resourceType && resource.resourceType !== resourceType) {
        throw new Error(`Invalid resource type. Expected ${resourceType}, got ${resource.resourceType}`);
      }

      // Perform comprehensive FHIR validation
      const validationResult = await fhirService.current.validateResource(resource as IFHIRResource);

      if (!validationResult.valid) {
        setValidationErrors(validationResult.errors);
        onValidationError(validationResult.errors);
        throw new Error('FHIR validation failed');
      }

      // Upload with retry logic
      while (uploadAttempts < retryAttempts) {
        try {
          const uploadedResource = await fhirService.current.uploadResource(resource as IFHIRResource);
          
          // Log successful upload
          onAuditEvent({
            type: 'FHIR_UPLOAD_SUCCESS',
            resourceType: uploadedResource.resourceType,
            resourceId: uploadedResource.id,
            timestamp: new Date().toISOString()
          });

          onUploadComplete(uploadedResource);
          break;
        } catch (error) {
          uploadAttempts++;
          if (uploadAttempts === retryAttempts) {
            throw error;
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, uploadAttempts) * 1000));
        }
      }
    } catch (error) {
      // Log upload failure
      onAuditEvent({
        type: 'FHIR_UPLOAD_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      onUploadError(error instanceof Error ? error : new Error('Upload failed'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [resourceType, onUploadComplete, onUploadError, onValidationError, onAuditEvent, validationTimeout, retryAttempts]);

  /**
   * Handles upload progress updates
   */
  const handleProgress = useCallback((progress: number) => {
    setUploadProgress(progress);
  }, []);

  /**
   * Handles upload errors with audit logging
   */
  const handleError = useCallback((error: any) => {
    setValidationErrors([{
      type: FHIRValidationErrorType.Format,
      field: 'file',
      message: error.message,
      code: 'UPLOAD_ERROR',
      severity: ValidationSeverity.Error,
      path: [],
      context: { error }
    }]);
    onUploadError(error);
  }, [onUploadError]);

  return (
    <Box className={className} role="region" aria-label="FHIR Resource Upload">
      <FileUpload
        onFileSelect={handleFileSelect}
        onError={handleError}
        onProgress={handleProgress}
        maxFileSize={maxFileSize}
        allowedFileTypes={[...allowedMimeTypes]}
        multiple={false}
        disabled={disabled || isUploading}
        validateFHIR={true}
        aria-label={accessibilityLabels.dropzone}
      />

      {isUploading && (
        <Box sx={{ mt: 2, textAlign: 'center' }} role="status" aria-label={accessibilityLabels.uploading}>
          <CircularProgress variant="determinate" value={uploadProgress} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Processing FHIR resource... {Math.round(uploadProgress)}%
          </Typography>
        </Box>
      )}

      {validationErrors.length > 0 && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          role="alert"
          aria-label={accessibilityLabels.error}
        >
          <AlertTitle>Validation Errors</AlertTitle>
          {validationErrors.map((error, index) => (
            <Typography key={index} variant="body2">
              {error.field}: {error.message}
            </Typography>
          ))}
        </Alert>
      )}
    </Box>
  );
};

export default FHIRUploader;