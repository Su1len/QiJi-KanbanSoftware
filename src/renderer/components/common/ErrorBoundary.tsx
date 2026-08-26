import React from 'react';
import { Button, Result } from 'antd';
import { currentLang } from '../../context/LanguageContext';
import { tr } from '../../i18n';

interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1d2e' }}>
          <Result
            status="error"
            title={tr('err.title', currentLang)}
            subTitle={this.state.error?.message || (currentLang === 'en' ? 'Unknown error' : '未知错误')}
            extra={
              <Button type="primary" onClick={() => window.location.reload()}>
                {tr('err.reload', currentLang)}
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
