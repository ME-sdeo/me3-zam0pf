import React, { useState, useCallback, useRef } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { validateFHIRResource } from '../../utils/validation.util';
import { FHIR_VALIDATION } from '../constants/validation.constants';
import { IFHIRValidationResult } from '../interfaces/fhir.interface';

/**
 * Interface for file upload error tracking
 */
interface FileUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Interface for file upload performance metrics
 */
interface UploadMetrics {
  startTime: number;
  endTime: number;
  fileSize: number;
  validationDuration: number;
}

/**
 * Props interface for the FileUpload component
 */
interface FileUploadProps {
  onFileSelect: (file: File, validationResult: IFHIRValidationResult) => void;
  onError: (error: FileUploadError) => void;
  onProgress: (progress: number) => void;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  validateFHIR?: boolean;
  'aria-label'?: string;
  telemetryEnabled?: boolean;
}

/**
 * Enterprise-grade file upload component with FHIR validation and accessibility support
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onError,
  onProgress,
  maxFileSize = FHIR_VALIDATION.MAX_RESOURCE_SIZE,
  allowedFileTypes = FHIR_VALIDATION.ALLOWED_FILE_TYPES,
  multiple = false,
  className,
  disabled = false,
  validateFHIR = true,
  'aria-label': ariaLabel = 'File upload dropzone',
  telemetryEnabled = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const metrics = useRef<UploadMetrics>({
    startTime: 0,
    endTime: 0,
    fileSize: 0,
    validationDuration: 0
  });

  /**
   * Handles file validation with comprehensive error checking
   */
  const validateFile = async (file: File): Promise<boolean> => {
    // Check file size
    if (file.size > maxFileSize) {
      onError({
        code: 'FILE_SIZE_ERROR',
        message: `File size exceeds maximum limit of ${maxFileSize / 1024 / 1024}MB`,
        details: { fileSize: file.size, maxSize: maxFileSize },
        timestamp: new Date()
      });
      return false;
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedFileTypes.includes(`.${fileExtension}`)) {
      onError({
        code: 'INVALID_FILE_TYPE',
        message: `File type .${fileExtension} is not supported. Allowed types: ${allowedFileTypes.join(', ')}`,
        details: { fileType: fileExtension, allowedTypes: allowedFileTypes },
        timestamp: new Date()
      });
      return false;
    }

    return true;
  };

  /**
   * Processes files with FHIR validation if enabled
   */
  const processFiles = async (files: FileList) => {
    setIsProcessing(true);
    metrics.current.startTime = Date.now();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        metrics.current.fileSize = file.size;

        if (await validateFile(file)) {
          const reader = new FileReader();

          reader.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              setUploadProgress(progress);
              onProgress(progress);
            }
          };

          reader.onload = async (event) => {
            try {
              if (validateFHIR && event.target?.result) {
                const content = event.target.result as string;
                const resource = JSON.parse(content);
                
                const validationStartTime = Date.now();
                const validationResult = await validateFHIRResource(resource, {
                  strictMode: true,
                  validateReferences: true
                });
                metrics.current.validationDuration = Date.now() - validationStartTime;

                if (validationResult.valid) {
                  onFileSelect(file, validationResult);
                } else {
                  onError({
                    code: 'FHIR_VALIDATION_ERROR',
                    message: 'FHIR validation failed',
                    details: { errors: validationResult.errors },
                    timestamp: new Date()
                  });
                }
              } else {
                onFileSelect(file, { valid: true, errors: [], warnings: [], processingTime: 0, resourceCount: 1 });
              }
            } catch (error) {
              onError({
                code: 'FILE_PROCESSING_ERROR',
                message: 'Error processing file content',
                details: { error },
                timestamp: new Date()
              });
            }
          };

          reader.readAsText(file);
        }
      }
    } catch (error) {
      onError({
        code: 'UNEXPECTED_ERROR',
        message: 'An unexpected error occurred during file processing',
        details: { error },
        timestamp: new Date()
      });
    } finally {
      metrics.current.endTime = Date.now();
      setIsProcessing(false);
      setUploadProgress(0);
      
      if (telemetryEnabled) {
        logTelemetry();
      }
    }
  };

  /**
   * Logs telemetry data for monitoring and performance tracking
   */
  const logTelemetry = () => {
    const { startTime, endTime, fileSize, validationDuration } = metrics.current;
    console.info('File Upload Telemetry', {
      totalDuration: endTime - startTime,
      fileSize,
      validationDuration,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * Handles drag events with error boundary
   */
  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      if (event.type === 'dragenter' || event.type === 'dragover') {
        setIsDragging(true);
      } else if (event.type === 'dragleave' || event.type === 'drop') {
        setIsDragging(false);
      }
    } catch (error) {
      onError({
        code: 'DRAG_EVENT_ERROR',
        message: 'Error handling drag event',
        details: { error },
        timestamp: new Date()
      });
    }
  }, []);

  /**
   * Handles file drop with error boundary
   */
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const { files } = event.dataTransfer;
      if (files && files.length > 0) {
        if (!multiple && files.length > 1) {
          onError({
            code: 'MULTIPLE_FILES_ERROR',
            message: 'Multiple file upload is not allowed',
            timestamp: new Date()
          });
          return;
        }
        processFiles(files);
      }
    } catch (error) {
      onError({
        code: 'DROP_EVENT_ERROR',
        message: 'Error handling file drop',
        details: { error },
        timestamp: new Date()
      });
    }
  }, [multiple]);

  /**
   * Handles file selection through input with error boundary
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const { files } = event.target;
      if (files && files.length > 0) {
        processFiles(files);
      }
    } catch (error) {
      onError({
        code: 'FILE_SELECT_ERROR',
        message: 'Error handling file selection',
        details: { error },
        timestamp: new Date()
      });
    }
  }, []);

  return (
    <Box
      ref={dropZoneRef}
      className={className}
      sx={{
        border: 2,
        borderRadius: 1,
        borderColor: isDragging ? 'primary.main' : 'grey.300',
        borderStyle: 'dashed',
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
        p: 3,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease-in-out'
      }}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={!disabled ? handleDrop : undefined}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      <input
        type="file"
        onChange={handleFileSelect}
        accept={allowedFileTypes.join(',')}
        multiple={multiple}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <Typography variant="h6" gutterBottom>
        {isDragging ? 'Drop files here' : 'Drag and drop files here or click to select'}
      </Typography>

      <Typography variant="body2" color="textSecondary">
        Supported formats: {allowedFileTypes.join(', ')}
      </Typography>

      <Typography variant="body2" color="textSecondary">
        Maximum file size: {maxFileSize / 1024 / 1024}MB
      </Typography>

      {isProcessing && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress variant="determinate" value={uploadProgress} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Processing file... {Math.round(uploadProgress)}%
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;