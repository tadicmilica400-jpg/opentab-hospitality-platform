// Autor: Ivana Mušikić 2023/0204
//
// SSU4 — Kreiranje grupe i pozivanje prijatelja za sto.
// Komponenta omogućava korisniku da kreira grupu za trenutni sto, pozove prijatelje,
// prihvati poziv u grupu i napusti aktivnu grupu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptMobileGroupInvite,
  createMobileGroup,
  declineMobileGroupInvite,
  getMobileGroupSummary,
  inviteMobileGroupFriend,
  leaveMobileGroup,
} from '../api/mobileGroups';
import type { MobileGroupFriend, MobileGroupInvite, MobileGroupMember, MobileGroupSummary } from '../api/mobileGroups';
import StandardBottomSheet from '../components/ui/StandardBottomSheet';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useTableSession } from '../context/TableSessionContext';
import { useToast } from '../context/ToastContext';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0]?.[0] ?? 'G').toUpperCase();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Došlo je do greške.';
}

function getAcceptedMembers(members: MobileGroupMember[]) {
  return members.filter((member) => member.status === 'active' || member.status === 'accepted');
}

function getInvitedMembers(members: MobileGroupMember[]) {
  return members.filter((member) => member.status === 'invited');
}

/**
 * GroupScreen prikazuje ekran za upravljanje grupom za trenutni sto.
 * @returns JSX ekran za grupu za stolom.
 */
export default function GroupScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session, isAuthenticated, isAnonymous, isCheckingSession } = useMobileAuth();
  const { tableSession, hasActiveTableSession, isCheckingTableSession, refreshTableSession } = useTableSession();

  const [summary, setSummary] = useState<MobileGroupSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);

  const tableLabel = summary?.tableLabel || tableSession?.table.label || localStorage.getItem('activeTableLabel') || 'sto';
  const group = summary?.group ?? null;
  const members = useMemo<MobileGroupMember[]>(() => group?.members ?? [], [group?.members]);
  const acceptedMembers = useMemo(() => getAcceptedMembers(members), [members]);
  const invitedMembers = useMemo(() => getInvitedMembers(members), [members]);
  const availableFriends = useMemo<MobileGroupFriend[]>(() => summary?.availableFriends ?? [], [summary?.availableFriends]);
  const groupInvites = useMemo<MobileGroupInvite[]>(() => summary?.invites ?? [], [summary?.invites]);

  const loadGroupSummary = useCallback(async () => {
    if (!session?.token || isAnonymous) {
      setSummary(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextSummary = await getMobileGroupSummary(session.token);
      setSummary(nextSummary);
    } catch (error) {
      setSummary(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [isAnonymous, session?.token]);

  useEffect(() => {
    if (isCheckingSession || isCheckingTableSession) {
      return;
    }

    loadGroupSummary();
  }, [isCheckingSession, isCheckingTableSession, loadGroupSummary]);

  async function runGroupAction(key: string, action: () => Promise<{ ok: boolean; summary: MobileGroupSummary }>, successMessage: string) {
    if (!session?.token) return;

    setActionKey(key);
    setErrorMessage('');

    try {
      const response = await action();
      setSummary(response.summary);
      showToast('success', successMessage);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      showToast('error', message);
    } finally {
      setActionKey(null);
    }
  }

  function handleCreateGroup() {
    void runGroupAction('create', () => createMobileGroup(session!.token), 'Grupa za sto je kreirana.');
  }

  function handleInviteFriend(friend: MobileGroupFriend) {
    void runGroupAction(
      `invite-${friend.id}`,
      () => inviteMobileGroupFriend(session!.token, friend.id),
      `Poziv je poslat korisniku ${friend.name}.`,
    );
  }

  function handleAcceptGroupInvite(invite: MobileGroupInvite) {
    void runGroupAction(
      `accept-${invite.inviteId}`,
      () => acceptMobileGroupInvite(session!.token, invite.inviteId),
      `Pridružili ste se grupi korisnika ${invite.name}.`,
    );
  }

  function handleDeclineGroupInvite(invite: MobileGroupInvite) {
    void runGroupAction(
      `decline-${invite.inviteId}`,
      () => declineMobileGroupInvite(session!.token, invite.inviteId),
      `Odbili ste poziv korisnika ${invite.name}.`,
    );
  }

  async function handleLeaveGroup() {
    await runGroupAction('leave', () => leaveMobileGroup(session!.token), 'Napustili ste grupu za stolom.');
    setLeaveSheetOpen(false);
    await refreshTableSession();
  }

  function renderIncomingInvitesInline() {
    if (!groupInvites.length) {
      return null;
    }

    return (
      <div className="ssu-group-card-block ssu-group-card-invites-block">
        <div className="ssu-group-mini-title-row">
          <div>
            <p className="eyebrow">Pozivi</p>
            <h3>Pozvani ste u grupu</h3>
          </div>
          <span className="ssu-status-pill">{groupInvites.length}</span>
        </div>

        <div className="ssu-user-list ssu-group-user-list">
          {groupInvites.map((invite) => (
            <article className="ssu-user-row stacked ssu-group-user-row" key={invite.inviteId}>
              <div className="ssu-mini-avatar">{getInitials(invite.name)}</div>

              <div className="ssu-user-info">
                <h3>{invite.name}</h3>
                <p>@{invite.username} · {invite.tableLabel}</p>
              </div>

              <div className="ssu-request-actions">
                <button
                  className="ssu-small-button"
                  onClick={() => handleAcceptGroupInvite(invite)}
                  disabled={actionKey === `accept-${invite.inviteId}`}
                >
                  Prihvati
                </button>

                <button
                  className="ssu-secondary-mini-button"
                  onClick={() => handleDeclineGroupInvite(invite)}
                  disabled={actionKey === `decline-${invite.inviteId}`}
                >
                  Odbij
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }


  if (isCheckingSession || isCheckingTableSession) {
    return (
      <div className="screen ssu-group-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">…</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Zajednički sto</p>
            <h1>Učitavanje grupe</h1>
            <p>Proveravamo sesiju korisnika i povezani sto.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!isAuthenticated || isAnonymous) {
    return (
      <div className="screen ssu-group-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">👥</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Grupa za stolom</p>
            <h1>Prijavite se za kreiranje grupe</h1>
            <p>
              Grupe su dostupne registrovanim korisnicima koji žele da pozovu prijatelje
              u zajedničku sesiju za stolom.
            </p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" onClick={() => navigate('/login')}>
              <span>Prijavi se</span>
              <span>→</span>
            </button>

            <button className="ssu-entry-action-button" onClick={() => navigate('/register')}>
              <span>Registruj se</span>
              <span>→</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!hasActiveTableSession) {
    return (
      <div className="screen ssu-group-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">QR</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Povezivanje stola</p>
            <h1>Prvo povežite sto</h1>
            <p>
              Za kreiranje ili prihvatanje grupe potrebno je da aplikacija bude povezana
              sa konkretnim stolom u restoranu.
            </p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" onClick={() => navigate('/scan')}>
              <span>Skeniraj QR kod stola</span>
              <span>⌁</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen ssu-group-screen ssu-screen ssu-group-polished-screen ssu-group-compact-screen ssu-group-centered-flow">
      {errorMessage ? (
        <section className="glass-card ssu-card ssu-group-panel-card ssu-group-status-card">
          <p className="ssu-empty-text">{errorMessage}</p>
          <button className="ssu-small-button" onClick={() => void loadGroupSummary()} disabled={isLoading}>
            Pokušaj ponovo
          </button>
        </section>
      ) : null}

      {isLoading ? (
        <section className="glass-card ssu-card ssu-group-panel-card ssu-group-status-card">
          <p className="ssu-empty-text">Učitavanje grupe...</p>
        </section>
      ) : null}

      {group === null ? (
        <section className="glass-card ssu-card ssu-group-create-card ssu-group-create-only-card ssu-group-single-card">
          <div className="ssu-group-create-icon">+</div>

          <div className="ssu-group-create-copy">
            <p className="eyebrow">Sto {tableLabel.replace(/^Sto\s*/i, '')}</p>
            <h2>Kreirajte grupu</h2>
            <p>
              Grupa važi za ovu posetu i ovaj sto. Pozovite prijatelje, pratite zajedničku porudžbinu i kasnije podelite račun.
            </p>
          </div>

          {renderIncomingInvitesInline()}

          <button
            className="primary-action-button ssu-main-action"
            onClick={handleCreateGroup}
            disabled={actionKey === 'create'}
          >
            <span>{actionKey === 'create' ? 'Kreiranje...' : 'Kreiraj grupu'}</span>
            <span>→</span>
          </button>
        </section>
      ) : (
        <section className="glass-card ssu-card ssu-group-panel-card ssu-group-members-card ssu-group-single-card">
          <div className="ssu-group-card-topline">
            <div className="ssu-group-create-icon ssu-group-active-icon">👥</div>
            <div>
              <p className="eyebrow">{group.tableLabel}</p>
              <h2>Grupa za stolom</h2>
              <p>{acceptedMembers.length} {acceptedMembers.length === 1 ? 'član' : 'članova'} u aktivnoj sesiji</p>
            </div>
          </div>

          <div className="ssu-group-card-block">
            <div className="ssu-group-mini-title-row">
              <h3>Članovi</h3>
              <span className="ssu-status-pill">{acceptedMembers.length}</span>
            </div>

            <div className="ssu-user-list ssu-group-user-list">
              {acceptedMembers.map((member) => {
                const isOwner = member.id === group.ownerGuestId;

                return (
                  <article className="ssu-user-row ssu-group-user-row" key={member.membershipId}>
                    <div className="ssu-mini-avatar">{getInitials(member.name)}</div>

                    <div className="ssu-user-info">
                      <h3>{member.name}</h3>
                      <p>@{member.username} · {isOwner ? 'vlasnik grupe' : 'član grupe'}</p>
                    </div>

                    <span className="ssu-member-badge active">Aktivan</span>
                  </article>
                );
              })}

              {invitedMembers.map((member) => (
                <article className="ssu-user-row ssu-group-user-row" key={member.membershipId}>
                  <div className="ssu-mini-avatar">{getInitials(member.name)}</div>

                  <div className="ssu-user-info">
                    <h3>{member.name}</h3>
                    <p>@{member.username} · poziv poslat</p>
                  </div>

                  <span className="ssu-member-badge">Pozvan</span>
                </article>
              ))}
            </div>
          </div>

          <div className="ssu-group-card-actions">
            <button className="primary-action-button ssu-main-action" type="button" onClick={() => setInviteSheetOpen(true)}>
              <span>Pozovi prijatelja</span>
              <span>+</span>
            </button>

            <button className="ssu-danger-button ssu-group-leave-button" onClick={() => setLeaveSheetOpen(true)} disabled={actionKey === 'leave'}>
              <span>{actionKey === 'leave' ? 'Napuštanje...' : 'Napusti grupu'}</span>
              <span>↗</span>
            </button>
          </div>
        </section>
      )}

      <StandardBottomSheet
        open={inviteSheetOpen}
        onClose={() => setInviteSheetOpen(false)}
        ariaLabel="Pozivanje prijatelja u grupu"
        sheetClassName="ssu-group-invite-sheet"
      >
        <div className="ssu-sheet-title-block">
          <p className="eyebrow">Grupa za stolom</p>
          <h2>Pozovi prijatelja</h2>
          <p>Izaberite prijatelja koji će se pridružiti istoj sesiji za stolom.</p>
        </div>

        <div className="ssu-user-list ssu-group-user-list ssu-group-sheet-list">
          {availableFriends.length > 0 ? (
            availableFriends.map((friend) => (
              <article className="ssu-user-row ssu-group-user-row" key={friend.id}>
                <div className="ssu-mini-avatar">{getInitials(friend.name)}</div>

                <div className="ssu-user-info">
                  <h3>{friend.name}</h3>
                  <p>@{friend.username}</p>
                </div>

                <button
                  className="ssu-small-button"
                  type="button"
                  onClick={() => handleInviteFriend(friend)}
                  disabled={actionKey === `invite-${friend.id}`}
                >
                  {actionKey === `invite-${friend.id}` ? '...' : 'Pozovi'}
                </button>
              </article>
            ))
          ) : (
            <div className="ssu-group-empty-friends">
              <p className="ssu-empty-text">Nema dostupnih prijatelja za pozivanje.</p>
              <button className="ssu-entry-action-button muted" onClick={() => navigate('/profile')} type="button">
                <span>Otvori prijatelje</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      </StandardBottomSheet>

      <StandardBottomSheet
        open={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        ariaLabel="Napuštanje grupe"
        sheetClassName="ssu-group-leave-sheet"
      >
        <div className="ssu-sheet-title-block">
          <p className="eyebrow">Napuštanje grupe</p>
          <h2>Želite da napustite grupu?</h2>
          <p>Narudžbine ostaju vezane za sto i račun, a vi izlazite samo iz grupne sesije.</p>
        </div>

        <div className="ssu-sheet-action-row">
          <button className="ssu-entry-action-button muted" type="button" onClick={() => setLeaveSheetOpen(false)}>
            <span>Ostani u grupi</span>
            <span>↩</span>
          </button>

          <button className="ssu-danger-button" type="button" onClick={() => void handleLeaveGroup()} disabled={actionKey === 'leave'}>
            <span>{actionKey === 'leave' ? 'Napuštanje...' : 'Napusti'}</span>
            <span>↗</span>
          </button>
        </div>
      </StandardBottomSheet>
    </div>
  );
}
