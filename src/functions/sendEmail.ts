import { gmail_v1 } from 'googleapis';
import { ISendEmailParams, ISendEmailFunctionResponse } from '../types';
import { isSubjectMimeEncoded } from '../utils/isSubjectMimeEncoded';
import { encodeSubject } from '../utils/encodeSubject';
import { isHtmlMessage } from '../utils/isHtmlMessage';

/**
 * Sends an email using the Gmail API client, supporting both HTML and plain text content. It automatically
 * MIME encodes the subject if it isn't already and determines whether the message content is HTML or plain text
 * to format the email appropriately.
 * 
 * @param {gmail_v1.Gmail} gmailClient The Gmail API client instance.
 * @param {ISendEmailParams} params Parameters required for sending the email, including sender, recipient, subject, and message content.
 * @returns {Promise<ISendEmailFunctionResponse>} The result of the email sending operation, including whether the email was sent successfully, the status message, and the raw Gmail API response.
 */

export async function sendEmailFunction(gmailClient: gmail_v1.Gmail, { senderEmail, recipientEmail, subject, message }: ISendEmailParams): Promise<ISendEmailFunctionResponse> {
    let finalSubject = subject; // Initialize finalSubject with the original subject
    const encodedCheck = isSubjectMimeEncoded({ subject });

    if (!encodedCheck.result) {
        // If subject is not MIME encoded, encode it
        const { status, result } = encodeSubject({ subject });
        if (status) {
            finalSubject = result;
        }
    }

    // Determine if the message is HTML or plain text
    const htmlCheck = isHtmlMessage({ message });
    let mimeMessage = `From: ${senderEmail}\r\nTo: ${recipientEmail}\r\nSubject: ${finalSubject}\r\n`;

    // Construct MIME message based on HTML check result
    const boundary = "----=_NextPart_" + Math.random().toString(36).substr(2, 9);
    if (htmlCheck.result) {
        mimeMessage += `Content-Type: multipart/alternative; boundary=${boundary}\r\n\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
            `${message}\r\n` +
            `--${boundary}--`;
    } else {
        mimeMessage += `Content-Type: text/plain; charset=UTF-8\r\n\r\n${message}`;
    }

    const encodedEmail = Buffer.from(mimeMessage, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
        const gmailResponse = await gmailClient.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedEmail },
        });

        return {
            sent: gmailResponse.status >= 200 && gmailResponse.status < 300,
            message: gmailResponse.status >= 200 && gmailResponse.status < 300 ?
                `Email successfully sent to ${recipientEmail}.` :
                `Failed to send email. Status: ${gmailResponse.status}`,
            gmailResponse: gmailResponse,
        };
    } catch (error: any) {
        return { sent: false, message: `An error occurred while sending the email: ${error.message}`, gmailResponse: null };
    }
}