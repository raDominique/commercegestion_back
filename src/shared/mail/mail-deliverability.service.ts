import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns/promises';

export interface DeliverabilityReport {
  ok: boolean;
  domain: string;
  smtpHost: string;
  smtpIps: string[];
  spfRecord: string;
  spfAllowedIps: string[];
  spfAllowed: boolean;
  dkimRecordExists: boolean;
  dmarcRecord: string;
  warnings: string[];
}

/**
 * Service de contrôle de délivrabilité SMTP.
 *
 * Vérifie au démarrage (et via endpoint) que le serveur SMTP est autorisé
 * à envoyer pour le domaine d'expédition : enregistrements SPF, DKIM et DMARC.
 *
 * Permet de détecter les anomalies du type : SPF n'autorisant pas l'IP réelle
 * du serveur d'envoi (cause courante de mails bloqués par Yahoo/Gmail).
 */
@Injectable()
export class MailDeliverabilityService {
  private readonly logger = new Logger(MailDeliverabilityService.name);

  constructor(private readonly configService: ConfigService) {}

  async check(): Promise<DeliverabilityReport> {
    const warnings: string[] = [];
    const smtpHost = this.configService.get<string>('SMTP_HOST') ?? '';
    const smtpFrom = this.configService.get<string>('SMTP_FROM') ?? '';
    const domain =
      this.extractDomain(smtpFrom) || this.extractHostnameDomain(smtpHost);

    let smtpIps: string[] = [];
    try {
      smtpIps = await this.resolveHost(smtpHost);
    } catch (error) {
      smtpIps = [];
      warnings.push(
        `Impossible de résoudre le SMTP_HOST "${smtpHost}": ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    let spfRecord = '';
    let spfAllowedIps: string[] = [];
    try {
      const txt = await dns.resolveTxt(domain);
      const flat = txt.map((chunks) => chunks.join('')).join(' ');
      spfRecord = (flat.match(/v=spf1[^]*?(?=\sv=|$)/) || [])[0] ?? '';
      if (spfRecord) {
        spfAllowedIps = Array.from(await this.parseSpf(domain, spfRecord));
      }
    } catch (error) {
      warnings.push(
        `Pas d'enregistrement SPF trouvé pour ${domain}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    let dmarcRecord = '';
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`);
      dmarcRecord = dmarcTxt.map((chunks) => chunks.join('')).join(' ');
    } catch {
      warnings.push(`Pas d'enregistrement DMARC trouvé pour ${domain}`);
    }

    let dkimRecordExists = false;
    try {
      const dkimTxt = await dns.resolveTxt(`default._domainkey.${domain}`);
      dkimRecordExists = dkimTxt.length > 0;
    } catch {
      warnings.push(
        `Pas d'enregistrement DKIM (selecteur "default") trouvé pour ${domain}`,
      );
    }

    const spfAllowed = spfAllowedIps.some((allowed) =>
      smtpIps.some((ip) => this.isIpAllowed(ip, allowed)),
    );

    if (!spfAllowed && spfRecord) {
      warnings.push(
        `SPF en échec : les IP SMTP [${smtpIps.join(', ')}] ne sont pas autorisées par la politique SPF "${spfRecord}". Mettez à jour le SPF (ajoutez les IP d'envoi).`,
      );
    }

    const ok = spfAllowed && dkimRecordExists && dmarcRecord.length > 0;

    return {
      ok,
      domain,
      smtpHost,
      smtpIps,
      spfRecord,
      spfAllowedIps,
      spfAllowed,
      dkimRecordExists,
      dmarcRecord,
      warnings,
    };
  }

  async logReport(): Promise<void> {
    try {
      const report = await this.check();
      this.logger.log(
        `[Deliverability] ${report.domain} — SPF: ${report.spfAllowed ? 'OK' : 'FAIL'} — DKIM: ${report.dkimRecordExists ? 'OK' : 'FAIL'} — DMARC: ${report.dmarcRecord ? 'OK' : 'FAIL'}`,
      );
      for (const warning of report.warnings) {
        this.logger.warn(`[Deliverability] ${warning}`);
      }
    } catch (error) {
      this.logger.error(
        `[Deliverability] Échec du check: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  // ─── Parsing SPF ─────────────────────────────────────────────────────────────

  private async parseSpf(
    domain: string,
    record: string,
    depth = 0,
    allowed: Set<string> = new Set(),
  ): Promise<Set<string>> {
    if (depth > 5) return allowed;

    for (const token of record.split(/\s+/).slice(1)) {
      if (
        !token ||
        token.startsWith('+all') ||
        token.startsWith('~all') ||
        token.startsWith('-all')
      )
        continue;

      if (token.startsWith('ip4:')) {
        allowed.add(token.slice(4));
      } else if (token.startsWith('ip6:')) {
        allowed.add(token.slice(4));
      } else if (token.startsWith('include:')) {
        const includeDomain = token.slice(8);
        try {
          const txt = await dns.resolveTxt(includeDomain);
          const spfRec = txt
            .map((chunks) => chunks.join(''))
            .find((entry) => entry.startsWith('v=spf1'));
          if (spfRec)
            await this.parseSpf(includeDomain, spfRec, depth + 1, allowed);
        } catch {
          // include injoignable — on continue
        }
      } else if (token === 'a') {
        for (const ip of await this.resolveHost(domain)) allowed.add(ip);
      } else if (token === 'mx') {
        try {
          const mx = await dns.resolveMx(domain);
          for (const entry of mx) {
            for (const ip of await this.resolveHost(entry.exchange)) {
              allowed.add(ip);
            }
          }
        } catch {
          // pas de MX — on continue
        }
      }
    }
    return allowed;
  }

  // ─── Utilitaires réseau ──────────────────────────────────────────────────────

  private async resolveHost(host: string): Promise<string[]> {
    const out: string[] = [];
    try {
      const v4 = await dns.resolve4(host);
      out.push(...v4);
    } catch {
      // pas d'A — on ignore
    }
    try {
      const v6 = await dns.resolve6(host);
      out.push(...v6);
    } catch {
      // pas d'AAAA — on ignore
    }
    if (out.length === 0) {
      // Fallback OS-backed resolver (getaddrinfo) — plus fiable que c-ares
      // dans certains environnements Windows/Docker.
      try {
        const lookup = await dns.lookup(host, { all: true });
        for (const addr of lookup) out.push(addr.address);
      } catch {
        // impossible de résoudre — on renvoie une liste vide
      }
    }
    return out;
  }

  private extractDomain(email: string): string {
    const at = email.lastIndexOf('@');
    if (at === -1) return '';
    return email
      .slice(at + 1)
      .trim()
      .toLowerCase();
  }

  private extractHostnameDomain(host: string): string {
    const h = host.trim().toLowerCase();
    if (!h || h === 'localhost') return '';
    const parts = h.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : h;
  }

  private ipToLong(ip: string): number | null {
    if (ip.includes(':')) return null; // IPv6 géré séparément
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
    return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
  }

  private isIpAllowed(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = bitsStr ? Number(bitsStr) : 32;

    // IPv6
    if (ip.includes(':')) {
      return ip === range || cidr.includes('/') ? ip === range : false;
    }

    const ipLong = this.ipToLong(ip);
    const rangeLong = this.ipToLong(range);
    if (ipLong === null || rangeLong === null) return false;

    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipLong & mask) === (rangeLong & mask);
  }
}
