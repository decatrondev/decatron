import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function TipsTerms() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
                    <p className="text-gray-400">Decatron Tips & Donations</p>
                    <p className="text-sm text-gray-500 mt-2">Last updated: February 2026</p>
                </div>

                {/* Content */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 space-y-6 text-gray-300">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By making a donation through the Decatron Tips platform, you agree to these
                            Terms of Service. If you do not agree to these terms, please do not use
                            this service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Nature of Donations</h2>
                        <p className="mb-3">
                            <strong>Donations are voluntary contributions</strong> made to support content creators.
                            By making a donation, you acknowledge that:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Donations are gifts and are <strong>non-refundable</strong></li>
                            <li>You are not purchasing any goods or services</li>
                            <li>The content creator is not obligated to provide anything in return</li>
                            <li>Donations do not create any contractual relationship between you and the streamer</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Eligibility</h2>
                        <p>To use this service, you must:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                            <li>Be at least 18 years of age</li>
                            <li>Have a valid PayPal account or accepted payment method</li>
                            <li>Have the legal capacity to enter into this agreement</li>
                            <li>Not be prohibited from using PayPal services</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. User Conduct</h2>
                        <p className="mb-3">When using our donation service, you agree NOT to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Send messages containing hate speech, harassment, or discriminatory content</li>
                            <li>Include illegal, obscene, or inappropriate content in your messages</li>
                            <li>Impersonate other individuals or use misleading names</li>
                            <li>Use the service for money laundering or fraudulent purposes</li>
                            <li>Attempt to circumvent platform rules or exploit technical vulnerabilities</li>
                        </ul>
                        <p className="mt-3">
                            We reserve the right to filter or block messages that violate these guidelines.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Payment Processing</h2>
                        <p className="mb-3">
                            All payments are processed through PayPal. By making a donation, you also agree
                            to PayPal's{' '}
                            <a
                                href="https://www.paypal.com/us/legalhub/useragreement-full"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline"
                            >
                                User Agreement
                            </a>.
                        </p>
                        <p>
                            Decatron acts as an intermediary platform and is not responsible for
                            PayPal's services, fees, or policies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Refund Policy</h2>
                        <p className="mb-3">
                            <strong>All donations are final and non-refundable.</strong> As donations are
                            voluntary gifts to content creators, we cannot process refunds except in cases of:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Technical errors resulting in duplicate charges</li>
                            <li>Unauthorized transactions (fraud)</li>
                        </ul>
                        <p className="mt-3">
                            For payment disputes, please contact PayPal directly or reach out to our support.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Display of Donations</h2>
                        <p>
                            By making a donation with a message, you grant the content creator and Decatron
                            permission to display your chosen name and message publicly on their stream
                            and related media. You are responsible for the content of your messages.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
                        <p>
                            The donation service is provided "as is" without warranties of any kind.
                            We do not guarantee uninterrupted service or that donations will always
                            be displayed on stream due to technical factors outside our control.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
                        <p>
                            Decatron shall not be liable for any indirect, incidental, special, or
                            consequential damages arising from your use of the donation service.
                            Our liability is limited to the amount of your donation.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">10. Streamer Responsibility</h2>
                        <p>
                            Content creators using Decatron Tips are independent users of our platform.
                            Decatron is not responsible for the actions, content, or behavior of any
                            streamer. Disputes between donors and streamers should be resolved directly
                            between the parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">11. Modifications</h2>
                        <p>
                            We reserve the right to modify these terms at any time. Continued use of
                            the service after changes constitutes acceptance of the modified terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">12. Governing Law</h2>
                        <p>
                            These terms shall be governed by and construed in accordance with applicable
                            laws. Any disputes shall be resolved through appropriate legal channels.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">13. Contact</h2>
                        <p>
                            For questions about these terms, please contact us at:{' '}
                            <a
                                href="mailto:support@decatron.net"
                                className="text-purple-400 hover:text-purple-300 underline"
                            >
                                support@decatron.net
                            </a>
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 space-y-4">
                    <Link
                        to="/tip/privacy"
                        className="text-purple-400 hover:text-purple-300 underline"
                    >
                        View Privacy Policy
                    </Link>
                    <p className="text-gray-500 text-sm">
                        Powered by Decatron
                    </p>
                </div>
            </div>
        </div>
    );
}
