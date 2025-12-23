/**
 * AlertPopup Component Tests
 *
 * Tests for the AlertPopup notification component including:
 * - Rendering with alerts
 * - Close button functionality
 * - Push notification prompt
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the notification APIs before importing the component
jest.mock('@/lib/api/notifications', () => ({
  notificationsAPI: {
    checkAlerts: jest.fn(),
  },
  Alert: {},
}));

jest.mock('@/lib/api/push', () => ({
  setupPushNotifications: jest.fn(),
  isPushSupported: jest.fn(),
  getNotificationPermission: jest.fn(),
}));

import AlertPopup from '@/components/AlertPopup';
import { notificationsAPI } from '@/lib/api/notifications';
import { isPushSupported, getNotificationPermission, setupPushNotifications } from '@/lib/api/push';

describe('AlertPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when loading', () => {
    it('should return null while loading', () => {
      (notificationsAPI.checkAlerts as jest.Mock).mockReturnValue(new Promise(() => {}));
      (isPushSupported as jest.Mock).mockReturnValue(false);
      (getNotificationPermission as jest.Mock).mockReturnValue('denied');

      const { container } = render(<AlertPopup />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when no alerts and no push prompt', () => {
    it('should return null', async () => {
      (notificationsAPI.checkAlerts as jest.Mock).mockResolvedValue({ alerts: [] });
      (isPushSupported as jest.Mock).mockReturnValue(false);
      (getNotificationPermission as jest.Mock).mockReturnValue('denied');

      const { container } = render(<AlertPopup />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('when alerts exist', () => {
    const mockAlerts = [
      {
        type: 'record_missing',
        severity: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert message',
      },
    ];

    beforeEach(() => {
      (notificationsAPI.checkAlerts as jest.Mock).mockResolvedValue({ alerts: mockAlerts });
      (isPushSupported as jest.Mock).mockReturnValue(false);
      (getNotificationPermission as jest.Mock).mockReturnValue('denied');
    });

    it('should render alert popup with header', async () => {
      render(<AlertPopup />);

      await waitFor(() => {
        expect(screen.getByText('알림')).toBeInTheDocument();
      });
    });

    it('should display alert title and message', async () => {
      render(<AlertPopup />);

      await waitFor(() => {
        expect(screen.getByText('Test Alert')).toBeInTheDocument();
        expect(screen.getByText('This is a test alert message')).toBeInTheDocument();
      });
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<AlertPopup onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('알림')).toBeInTheDocument();
      });

      // Click the X button (first button in header)
      const closeButtons = screen.getAllByRole('button');
      fireEvent.click(closeButtons[0]);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when confirm button is clicked', async () => {
      const onClose = jest.fn();
      render(<AlertPopup onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('확인')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('확인'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('push notification prompt', () => {
    beforeEach(() => {
      (notificationsAPI.checkAlerts as jest.Mock).mockResolvedValue({ alerts: [] });
      (isPushSupported as jest.Mock).mockReturnValue(true);
      (getNotificationPermission as jest.Mock).mockReturnValue('default');
    });

    it('should show push prompt when supported and permission is default', async () => {
      render(<AlertPopup />);

      await waitFor(() => {
        expect(screen.getByText('푸시 알림 설정')).toBeInTheDocument();
        expect(screen.getByText('알림 허용하기')).toBeInTheDocument();
      });
    });

    it('should call setupPushNotifications when enable button is clicked', async () => {
      (setupPushNotifications as jest.Mock).mockResolvedValue(true);

      render(<AlertPopup />);

      await waitFor(() => {
        expect(screen.getByText('알림 허용하기')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('알림 허용하기'));

      await waitFor(() => {
        expect(setupPushNotifications).toHaveBeenCalled();
      });
    });
  });

  describe('styling', () => {
    it('should apply warning styles for warning severity', async () => {
      const warningAlert = {
        type: 'record_missing',
        severity: 'warning',
        title: 'Warning Alert',
        message: 'Warning message',
      };

      (notificationsAPI.checkAlerts as jest.Mock).mockResolvedValue({ alerts: [warningAlert] });
      (isPushSupported as jest.Mock).mockReturnValue(false);
      (getNotificationPermission as jest.Mock).mockReturnValue('denied');

      render(<AlertPopup />);

      await waitFor(() => {
        // Find the alert container by its class pattern
        const alertContainer = document.querySelector('.bg-amber-50');
        expect(alertContainer).toBeInTheDocument();
      });
    });

    it('should apply info styles for non-warning severity', async () => {
      const infoAlert = {
        type: 'info',
        severity: 'info',
        title: 'Info Alert',
        message: 'Info message',
      };

      (notificationsAPI.checkAlerts as jest.Mock).mockResolvedValue({ alerts: [infoAlert] });
      (isPushSupported as jest.Mock).mockReturnValue(false);
      (getNotificationPermission as jest.Mock).mockReturnValue('denied');

      render(<AlertPopup />);

      await waitFor(() => {
        // Find the alert container by its class pattern
        const alertContainer = document.querySelector('.bg-blue-50');
        expect(alertContainer).toBeInTheDocument();
      });
    });
  });
});
