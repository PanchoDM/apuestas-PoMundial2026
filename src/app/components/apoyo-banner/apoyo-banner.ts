import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-apoyo-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './apoyo-banner.html',
  styleUrl: './apoyo-banner.scss',
})
export class ApoyoBannerComponent {
  @Output() close = new EventEmitter<void>();

  readonly yapeNombre = 'Carlos Franchesco De La Cruz Merino';
  readonly yapeNumero = '931 292 817';
}
