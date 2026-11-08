-- Adds the editable "Founder & Owner message" homepage block (runs automatically on deploy).
-- The text is a TEMPLATE — replace it with the owner's own words in Website CMS.
INSERT INTO "cms_pages" ("key", "title", "content")
VALUES (
  'founder_message',
  'Founder & Owner Message',
  '{
    "enabled": true,
    "eyebrow": "Message from our founder",
    "title": "Your trust is our biggest strength",
    "message": "Namaskar! Thank you for choosing Sakshi Mobile.\n\nOur aim is simple — to help every customer choose the right phone at the right price, with honest advice and genuine products. Whether you are buying your first smartphone or upgrading to the latest model, our team is here to help you before and after your purchase.\n\nVisit our store or message us on WhatsApp anytime — we will be happy to help.",
    "name": "",
    "designation": "Founder & Owner, Sakshi Mobile",
    "photoUrl": "",
    "highlights": [
      { "label": "Genuine products" },
      { "label": "Honest advice" },
      { "label": "Support after purchase" }
    ]
  }'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
