import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react-native';
import { getThemePalette } from '../theme/colors';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  copied: boolean;
  resetKey: number;
}

/**
 * Root recovery boundary catching unhandled render/lifecycle errors across the app
 * so users can copy diagnostics or reload cleanly instead of hitting a blank crash screen.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
    componentStack: '',
    copied: false,
    resetKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({
      error,
      componentStack: info?.componentStack ? String(info.componentStack).trim() : '',
    });
  }

  private handleReload = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      componentStack: '',
      copied: false,
      resetKey: prev.resetKey + 1,
    }));
  };

  private handleCopyDetails = async () => {
    const { error, componentStack } = this.state;
    const summary = [
      `NekoChat Error: ${error?.name || 'Error'} - ${error?.message || 'Unknown error'}`,
      error?.stack ? `\nStack:\n${error.stack.slice(0, 1500)}` : '',
      componentStack ? `\nComponent Stack:\n${componentStack.slice(0, 1000)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Clipboard.setStringAsync(summary);
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summary).catch(() => {});
      }
    }
    this.setState({ copied: true });
    setTimeout(() => {
      this.setState({ copied: false });
    }, 2000);
  };

  render() {
    if (!this.state.hasError) {
      return (
        <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
      );
    }

    const palette = getThemePalette();
    const message = this.state.error?.message || 'Unexpected rendering error.';

    return (
      <View style={[styles.container, { backgroundColor: palette.bgDark }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgSurface,
              borderColor: `rgba(${palette.accentRgb}, 0.32)`,
            },
          ]}
        >
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: `rgba(${palette.accentRgb}, 0.14)`,
                borderColor: `rgba(${palette.accentRgb}, 0.35)`,
              },
            ]}
          >
            <AlertTriangle size={24} color={palette.accent} />
          </View>

          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            NekoChat hit an unexpected UI error, but your local chats and settings are safe.
          </Text>

          <View style={styles.errorBox}>
            <Text style={styles.errorText} numberOfLines={5}>
              {message}
            </Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={this.handleCopyDetails}
              activeOpacity={0.8}
            >
              {this.state.copied ? (
                <Check size={15} color={palette.accent} />
              ) : (
                <Copy size={15} color="#e2e8f0" />
              )}
              <Text
                style={[
                  styles.secondaryBtnText,
                  this.state.copied && { color: palette.accent },
                ]}
              >
                {this.state.copied ? 'Copied' : 'Copy Details'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
              onPress={this.handleReload}
              activeOpacity={0.85}
            >
              <RotateCcw size={15} color="#000000" />
              <Text style={styles.primaryBtnText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  errorBox: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 11.5,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  secondaryBtnText: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
