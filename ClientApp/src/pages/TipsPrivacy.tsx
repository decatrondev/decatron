import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function TipsPrivacy() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
                    <p className="text-gray-400">Decatron Tips & Donations</p>
                    <p className="text-sm text-gray-500 mt-2">Last updated: February 2026</p>
                </div>

                {/* Content */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 space-y-6 text-gray-300">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                        <p className="mb-3">When you make a donation through our platform, we collect:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Display Name:</strong> The name you choose to show on the stream</li>
                            <li><strong>Donation Amount:</strong> The amount you choose to donate</li>
                            <li><strong>Message:</strong> Any optional message you include with your donation</li>
                            <li><strong>Transaction ID:</strong> PayPal order reference for record-keeping</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Payment Processing</h2>
                        <p className="mb-3">
                            All payments are processed securely through <strong>PayPal</strong>. We do not store,
                            process, or have access to your payment card details, bank account information,
                            or PayPal login credentials.
                        </p>
                        <p>
                            PayPal handles all financial transactions according to their own{' '}
                            <a
                                href="https://www.paypal.com/us/legalhub/privacy-full"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline"
                            >
                                Privacy Policy
                            </a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
                        <p className="mb-3">The information collected is used to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Display your donation and message on the streamer's broadcast</li>
                            <li>Send confirmation of your donation</li>
                            <li>Maintain transaction records for the streamer</li>
                            <li>Provide customer support if needed</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Information Sharing</h2>
                        <p className="mb-3">We share your information with:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>The Streamer:</strong> Your display name, donation amount, and message are shared with and displayed by the content creator you're supporting</li>
                            <li><strong>PayPal:</strong> Payment information necessary to process your transaction</li>
                            <li><strong>Stream Viewers:</strong> Your display name and message may be shown on the live broadcast</li>
                        </ul>
                        <p className="mt-3">We do not sell your personal information to third parties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
                        <p>
                            Donation records are retained for accounting and support purposes.
                            Transaction history is kept for the duration required by applicable laws
                            and for dispute resolution purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
                        <p className="mb-3">You have the right to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Request information about data we hold about you</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your data (subject to legal retention requirements)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Cookies and Tracking</h2>
                        <p>
                            The donation page uses minimal cookies necessary for the PayPal integration
                            to function. We do not use tracking cookies or analytics on public donation pages.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Children's Privacy</h2>
                        <p>
                            Our donation service is not intended for users under 18 years of age.
                            We do not knowingly collect information from minors.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
                        <p>
                            We may update this privacy policy from time to time. Changes will be posted
                            on this page with an updated revision date.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">10. Contact Us</h2>
                        <p>
                            For privacy-related inquiries, please contact us at:{' '}
                            <a
                                href="mailto:privacy@decatron.net"
                                className="text-purple-400 hover:text-purple-300 underline"
                            >
                                privacy@decatron.net
                            </a>
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 space-y-4">
                    <Link
                        to="/tip/terms"
                        className="text-purple-400 hover:text-purple-300 underline"
                    >
                        View Terms of Service
                    </Link>
                    <p className="text-gray-500 text-sm">
                        Powered by Decatron
                    </p>
                </div>
            </div>
        </div>
    );
}
