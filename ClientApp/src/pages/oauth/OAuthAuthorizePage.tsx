import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Shield,
    CheckCircle,
    XCircle,
    Loader2,
    ExternalLink,
    AlertTriangle,
    Lock,
    Eye,
    Edit3,
    Zap,
    ArrowRight
} from 'lucide-react';
import api from '../../services/api';

interface AppInfo {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    website_url: string | null;
    is_verified: boolean;
    owner: string | null;
}

interface ScopeInfo {
    scope: string;
    info: {
        name: string;
        description: string;
        category: string;
    } | null;
}

interface AuthorizeData {
    app: AppInfo;
    requested_scopes: ScopeInfo[];
    redirect_uri: string;
    state: string | null;
}

export default function OAuthAuthorizePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [authorizing, setAuthorizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authData, setAuthData] = useState<AuthorizeData | null>(null);
    const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());

    // URL params
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const responseType = searchParams.get('response_type');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');

    useEffect(() => {
        validateAndLoadApp();
    }, [clientId, redirectUri, responseType, scope]);

    const validateAndLoadApp = async () => {
        if (!clientId || !redirectUri || !responseType || !scope) {
            setError('Missing required OAuth parameters');
            setLoading(false);
            return;
        }

        if (responseType !== 'code') {
            setError('Unsupported response_type. Only "code" is supported.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await api.get('/oauth/authorize', {
                params: {
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    response_type: responseType,
                    scope: scope,
                    state: state,
                    code_challenge: codeChallenge,
                    code_challenge_method: codeChallengeMethod
                }
            });

            if (res.data.app) {
                setAuthData({
                    app: res.data.app,
                    requested_scopes: res.data.requested_scopes,
                    redirect_uri: res.data.redirect_uri,
                    state: res.data.state
                });

                // Pre-select all requested scopes
                const allScopes = new Set(res.data.requested_scopes.map((s: ScopeInfo) => s.scope));
                setSelectedScopes(allScopes);
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error_description ||
                            err.response?.data?.error ||
                            'Failed to load authorization details';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleAuthorize = async () => {
        if (!authData) return;

        // Check if user is logged in first
        const token = localStorage.getItem('token');
        if (!token) {
            // Not logged in - redirect to login with return URL
            const returnUrl = encodeURIComponent(window.location.href);
            window.location.href = `/login?returnUrl=${returnUrl}`;
            return;
        }

        try {
            setAuthorizing(true);
            const res = await api.post('/oauth/authorize', {
                clientId: clientId,
                redirectUri: redirectUri,
                approvedScopes: Array.from(selectedScopes),
                state: state,
                codeChallenge: codeChallenge,
                codeChallengeMethod: codeChallengeMethod,
                approved: true
            });

            if (res.data.redirect_url) {
                // Redirect to the app's callback URL with the authorization code
                window.location.href = res.data.redirect_url;
            }
        } catch (err: any) {
            if (err.response?.status === 401 || err.message === 'Token expirado' || err.message === 'Token inválido') {
                // Session expired - redirect to login
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `/login?returnUrl=${returnUrl}`;
            } else {
                const errorMsg = err.response?.data?.error || 'Authorization failed';
                setError(errorMsg);
            }
        } finally {
            setAuthorizing(false);
        }
    };

    const handleDeny = async () => {
        if (!redirectUri) return;

        // For deny, we don't need to be logged in - just redirect with error
        let errorUrl = `${redirectUri}?error=access_denied`;
        if (state) {
            errorUrl += `&state=${encodeURIComponent(state)}`;
        }
        window.location.href = errorUrl;
    };

    const toggleScope = (scopeName: string) => {
        const newScopes = new Set(selectedScopes);
        if (newScopes.has(scopeName)) {
            newScopes.delete(scopeName);
        } else {
            newScopes.add(scopeName);
        }
        setSelectedScopes(newScopes);
    };

    const getScopeIcon = (category: string) => {
        switch (category) {
            case 'read':
                return <Eye className="w-4 h-4 text-blue-400" />;
            case 'write':
                return <Edit3 className="w-4 h-4 text-orange-400" />;
            case 'action':
                return <Zap className="w-4 h-4 text-red-400" />;
            default:
                return <Lock className="w-4 h-4 text-gray-400" />;
        }
    };

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 mx-auto mb-6 bg-red-600/20 rounded-full flex items-center justify-center">
                        <XCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">Authorization Error</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!authData) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-lg w-full">
                {/* App Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        {/* App Icon */}
                        {authData.app.icon_url ? (
                            <img
                                src={authData.app.icon_url}
                                alt={authData.app.name}
                                className="w-16 h-16 rounded-xl object-cover"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl font-bold">
                                    {authData.app.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}

                        <ArrowRight className="w-6 h-6 text-gray-500" />

                        {/* Decatron Logo */}
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                            <Shield className="w-8 h-8" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold mb-1">
                        Authorize {authData.app.name}
                    </h1>
                    {authData.app.is_verified && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs mb-2">
                            <CheckCircle className="w-3 h-3" />
                            Verified Application
                        </div>
                    )}
                    {authData.app.description && (
                        <p className="text-gray-400 text-sm mt-2">
                            {authData.app.description}
                        </p>
                    )}
                    {authData.app.website_url && (
                        <a
                            href={authData.app.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-400 text-sm mt-2 hover:underline"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {new URL(authData.app.website_url).hostname}
                        </a>
                    )}
                </div>

                {/* Warning for unverified apps */}
                {!authData.app.is_verified && (
                    <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-yellow-400 font-medium text-sm">
                                    Unverified Application
                                </p>
                                <p className="text-yellow-200/70 text-xs mt-1">
                                    This application has not been verified by Decatron.
                                    Only authorize if you trust the developer.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Requested Permissions */}
                <div className="mb-6">
                    <h2 className="text-sm font-medium text-gray-300 mb-3">
                        This application wants to:
                    </h2>
                    <div className="space-y-2">
                        {authData.requested_scopes.map((scopeData) => (
                            <label
                                key={scopeData.scope}
                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                    selectedScopes.has(scopeData.scope)
                                        ? 'bg-purple-600/20 border border-purple-500/50'
                                        : 'bg-gray-900 border border-gray-700'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedScopes.has(scopeData.scope)}
                                    onChange={() => toggleScope(scopeData.scope)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {scopeData.info && getScopeIcon(scopeData.info.category)}
                                        <span className="font-medium text-sm">
                                            {scopeData.info?.name || scopeData.scope}
                                        </span>
                                    </div>
                                    {scopeData.info?.description && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            {scopeData.info.description}
                                        </p>
                                    )}
                                    <code className="text-xs text-purple-400/70 font-mono mt-1 block">
                                        {scopeData.scope}
                                    </code>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Redirect Info */}
                <div className="bg-gray-900 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Lock className="w-3 h-3" />
                        <span>
                            After authorization, you'll be redirected to:
                        </span>
                    </div>
                    <code className="text-xs text-blue-400 font-mono mt-1 block break-all">
                        {authData.redirect_uri}
                    </code>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={handleDeny}
                        disabled={authorizing}
                        className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Deny
                    </button>
                    <button
                        onClick={handleAuthorize}
                        disabled={authorizing || selectedScopes.size === 0}
                        className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {authorizing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Authorizing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Authorize
                            </>
                        )}
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-500 mt-6">
                    By authorizing, you agree to share the selected information with {authData.app.name}.
                    You can revoke access at any time from your account settings.
                </p>
            </div>
        </div>
    );
}
