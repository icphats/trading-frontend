<script lang="ts">
  interface FooterLink {
    label: string;
    href: string;
  }

  interface FooterSection {
    title: string;
    links: FooterLink[];
  }

  // Define footer sections with new 3-column layout
  const sections: FooterSection[] = [
    {
      title: 'App',
      links: [
        { label: 'Trade', href: '/trade' },
        { label: 'Portfolio', href: '/portfolio' },
        { label: 'Explore', href: '/explore' },
        { label: 'Stats', href: '/stats' }
      ]
    },
    {
      title: 'Create',
      links: [
        { label: 'Token', href: '/create/token' },
        { label: 'Market', href: '/create/market' }
      ]
    },
    {
      title: 'Learn',
      links: [
        { label: 'Docs', href: 'https://docs.partyhats.xyz' }
      ]
    }
  ];

  // Social links
  const socials = [
    {
      name: 'GitHub',
      href: 'https://github.com',
      color: '#00C32B',
      icon: 'github'
    },
    {
      name: 'Twitter',
      href: 'https://x.com',
      color: '#20BAFF',
      icon: 'twitter'
    },
    {
      name: 'Discord',
      href: 'https://discord.com',
      color: '#5F51FF',
      icon: 'discord'
    }
  ];

  const currentYear = new Date().getFullYear();
</script>

<footer class="footer">
  <div class="footer-container">
    <!-- Main footer content - Social links left, link sections right -->
    <div class="footer-content">
      <!-- Social links on the left -->
      <div class="footer-socials">
        {#each socials as social}
          <a
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            class="social-link"
            style="--social-color: {social.color};"
            aria-label={social.name}
          >
            {#if social.icon === 'github'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            {:else if social.icon === 'twitter'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            {:else if social.icon === 'discord'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
            {/if}
          </a>
        {/each}
      </div>

      <!-- Link sections on the right -->
      <div class="footer-sections">
        {#each sections as section}
          <div class="footer-section">
            <h3 class="section-title">{section.title}</h3>
            <ul class="section-links">
              {#each section.links as link}
                <li>
                  <a href={link.href} class="footer-link">
                    {link.label}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>

    <!-- Separator -->
    <div class="footer-separator"></div>

    <!-- Bottom bar with logo -->
    <div class="footer-bottom">
      <span class="copyright">© {currentYear} - Partyhats</span>

      <a href="/" class="footer-logo" aria-label="Go Home">
        <img
          src="/tokens/party.svg"
          alt="Party"
          class="footer-logo-img"
        />
      </a>
    </div>
  </div>
</footer>

<style>
  .footer {
    width: 100%;
    padding: 0 2.5rem 2.5rem;
  }

  .footer-container {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  /* Footer logo */
  .footer-logo {
    display: inline-flex;
    transition: transform 0.15s ease-out;
  }

  .footer-logo:hover {
    transform: scale(1.05) rotate(6deg);
  }

  .footer-logo-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
    transition: all 0.15s ease-out;
  }

  /* Footer sections - 3 column layout */
  .footer-sections {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4rem;
  }

  .footer-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--foreground);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--muted-foreground);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .footer-link:hover {
    color: var(--foreground);
  }

  /* Separator */
  .footer-separator {
    height: 1px;
    background: var(--border);
    width: 100%;
  }

  /* Bottom bar */
  .footer-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .copyright {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  /* Social links */
  .footer-socials {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .social-link {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    transition: color 0.2s ease, transform 0.2s ease;
  }

  .social-link:hover {
    color: var(--social-color);
    transform: scale(1.1);
  }

  /* Responsive */
  @media (max-width: 767px) {
    .footer {
      padding: 0 clamp(0.75rem, 4vw, 1.5rem) clamp(1rem, 4vw, 2rem);
    }

    .footer-content {
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .footer-socials {
      order: -1;
    }

    .footer-sections {
      grid-template-columns: repeat(3, 1fr);
      gap: clamp(1rem, 5vw, 2rem);
    }

    .section-title {
      font-size: clamp(0.6875rem, 2.5vw, 0.875rem);
    }

    .footer-link {
      font-size: clamp(0.6875rem, 2.5vw, 0.875rem);
    }

    .copyright {
      font-size: clamp(0.6875rem, 2.5vw, 0.8125rem);
    }
  }
</style>
