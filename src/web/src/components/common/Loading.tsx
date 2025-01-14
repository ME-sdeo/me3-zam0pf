import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { colors } from '../../config/theme.config';

/**
 * Props interface for the Loading component
 */
interface LoadingProps {
  /** Size of the loading spinner: 'small' (24px), 'medium' (40px), or 'large' (56px) */
  size?: 'small' | 'medium' | 'large';
  /** Custom color override for the spinner. Defaults to theme primary color */
  color?: string;
  /** Whether to show spinner with a full-screen overlay background */
  overlay?: boolean;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * Utility function to convert size prop to pixel values
 */
const getSizeValue = (size: string = 'medium'): string => {
  const sizes = {
    small: '24px',
    medium: '40px',
    large: '56px'
  };
  return sizes[size] || sizes.medium;
};

/**
 * Keyframe animation for the spinner rotation
 */
const spinAnimation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

/**
 * Styled container component for the loading spinner
 */
const SpinnerContainer = styled.div<{ overlay?: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  position: ${props => props.overlay ? 'fixed' : 'relative'};
  top: ${props => props.overlay ? '0' : 'auto'};
  left: ${props => props.overlay ? '0' : 'auto'};
  width: ${props => props.overlay ? '100%' : 'auto'};
  height: ${props => props.overlay ? '100vh' : 'auto'};
  background: ${props => props.overlay ? 'rgba(0, 0, 0, 0.5)' : 'transparent'};
  z-index: ${props => props.overlay ? '9999' : '1'};
`;

/**
 * Styled spinner component with theme integration
 */
const Spinner = styled.div<{ size?: string; color?: string }>`
  width: ${props => getSizeValue(props.size)};
  height: ${props => getSizeValue(props.size)};
  border: 2px solid ${props => props.color || colors.primary.main};
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spinAnimation} 0.8s linear infinite;
  transform: translateZ(0);
  will-change: transform;
`;

/**
 * Visually hidden span for screen readers
 */
const ScreenReaderText = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/**
 * Loading component that provides visual feedback during asynchronous operations
 * Implements Material Design patterns with accessibility support
 */
const Loading: React.FC<LoadingProps> = React.memo(({
  size = 'medium',
  color,
  overlay = false,
  label = 'Loading...'
}) => {
  return (
    <SpinnerContainer overlay={overlay}>
      <Spinner
        size={size}
        color={color}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-busy={true}
      />
      <ScreenReaderText role="status">
        {label}
      </ScreenReaderText>
    </SpinnerContainer>
  );
});

Loading.displayName = 'Loading';

export default Loading;