<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-19 | Updated: 2026-05-19 -->

# src/email/templates

## Purpose

Handlebars email templates for transactional emails sent by the application. Each template defines the HTML structure and styling for a specific email type (verification, password reset, etc.). Templates use Handlebars syntax for variable interpolation and are rendered by the email service before sending.

## Key Files

| File | Description |
|------|-------------|
| `email-verification.hbs` | Email verification template; renders with `{{verificationUrl}}` variable; includes styled button and fallback link for email clients that don't support HTML |
| `password-reset.hbs` | Password reset template; renders with `{{resetUrl}}` variable; includes 15-minute expiration notice and styled reset button |

## For AI Agents

### Working In This Directory

- **Template syntax**: Use Handlebars `{{variable}}` syntax for dynamic content; variables are passed from the email service.
- **HTML structure**: Templates are full HTML documents with DOCTYPE, head, and body; include meta tags for charset and viewport.
- **Inline styles**: Use inline CSS for email compatibility; most email clients strip external stylesheets.
- **Responsive design**: Use max-width: 600px and padding for mobile-friendly layouts.
- **Fallback links**: Always include a plain-text fallback link below the styled button for email clients that don't render HTML buttons.
- **Color scheme**: Use consistent colors (primary: #3498db, danger: #e74c3c, text: #333, muted: #7f8c8d).
- **Accessibility**: Use semantic HTML (h1, p, a); include alt text for images if used.

### Testing Requirements

- **Template rendering**: Test templates with the email service to verify variables are correctly interpolated.
- **Email client compatibility**: Preview rendered emails in multiple email clients (Gmail, Outlook, Apple Mail) to ensure styling is preserved.
- **Link validation**: Verify URLs in `{{verificationUrl}}` and `{{resetUrl}}` are correctly formatted and accessible.
- **Plain text fallback**: Ensure plain-text versions of links are readable and clickable.

### Common Patterns

- **Variable naming**: Use camelCase for Handlebars variables (e.g., `{{verificationUrl}}`, `{{resetUrl}}`).
- **Styling**: Use inline styles with consistent spacing (padding: 12px 24px for buttons, margin: 30px 0 for sections).
- **Typography**: Use Arial, sans-serif as fallback font; set line-height: 1.6 for readability.
- **Color contrast**: Ensure text color (#333) has sufficient contrast against background (white).
- **Email-safe HTML**: Avoid CSS Grid, Flexbox, or modern CSS features; use tables for complex layouts if needed.

## Dependencies

### Internal

- **email/email.service**: Renders templates using Handlebars; passes variables to templates.
- **email/email.module**: Loads templates from this directory during module initialization.

### External

- **handlebars**: Template engine; compiles and renders `.hbs` files with variable interpolation.
- **nodemailer**: Email transport; sends rendered HTML emails.
