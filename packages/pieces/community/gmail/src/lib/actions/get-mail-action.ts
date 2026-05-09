import { createAction, Property } from '@activepieces/pieces-framework';
import { GmailRequests } from '../common/data';
import { gmailAuth } from '../../';

export const gmailGetEmail = createAction({
  auth: gmailAuth,
  name: 'gmail_get_mail',
  description: 'Get an email from your Gmail account via Id',
  displayName: 'Get Email',
  props: {
    message_id: Property.ShortText({
      displayName: 'Message ID',
      description: 'The messageId of the mail to read',
      required: true,
    }),
  },
  run: async ({ auth, propsValue: { message_id } }) => {
    return await GmailRequests.getMailParsed({
      access_token: auth.access_token,
      message_id,
    });
  },
});
