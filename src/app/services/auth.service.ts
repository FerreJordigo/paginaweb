import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  User,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  UserCredential
} from '@angular/fire/auth';

import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { setPersistence, browserSessionPersistence, onAuthStateChanged } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private ngZone = inject(NgZone);

  private authState = new BehaviorSubject<User | null>(null);

  // Streams públicos
  user$!: Observable<User | null>;
  isAuthenticated$!: Observable<boolean>;

  private initialized = false;

  constructor() {}

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Persistencia
    setPersistence(this.auth, browserSessionPersistence)
      .catch(err => console.error('Error setPersistence:', err));

    // Observable manual (Firebase SDK nativo) => evita el warning de AngularFire
    this.user$ = new Observable<User | null>((subscriber) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (u) => {
          // re-entrar a Angular para change detection consistente
          this.ngZone.run(() => {
            this.authState.next(u);
            console.log('User state changed:', u);
            subscriber.next(u);
          });
        },
        (error) => {
          this.ngZone.run(() => subscriber.error(error));
        }
      );

      return () => unsubscribe();
    }).pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.isAuthenticated$ = this.user$.pipe(map(u => !!u));
  }

  login(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(this.auth, email, password));
  }

  register(email: string, password: string): Observable<UserCredential> {
    return from(createUserWithEmailAndPassword(this.auth, email, password));
  }

  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  get currentUser(): User | null {
    return this.authState.value;
  }

  get currentUserId(): string | null {
    return this.currentUser?.uid ?? null;
  }

  get currentUserEmail(): string | null {
    return this.currentUser?.email ?? null;
  }
}
