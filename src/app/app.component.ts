import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { MenuComponent } from './pages/menu/menu.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, MenuComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'proyecto';

  private authService = inject(AuthService);
  isAuthenticated$ = this.authService.isAuthenticated$;

  ngOnInit(): void {
    this.authService.init();
    // refrescar la referencia (opcional, pero recomendable)
    this.isAuthenticated$ = this.authService.isAuthenticated$;
  }
}
