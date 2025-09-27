// src/lib/tag-store.ts

'use client';

const TAG_STORE_KEY = 'solviz-address-tags';

export interface LocalTag {
    name: string;
    type: string;
}

function getStore(): Record<string, LocalTag> {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(TAG_STORE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error("Failed to read from local storage", error);
        return {};
    }
}

function saveStore(store: Record<string, LocalTag>) {
     if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(TAG_STORE_KEY, JSON.stringify(store));
        // Dispatch a storage event to notify other tabs/windows
        window.dispatchEvent(new StorageEvent('storage', {
            key: TAG_STORE_KEY,
            newValue: JSON.stringify(store)
        }));
    } catch (error) {
        console.error("Failed to write to local storage", error);
    }
}

export function getTag(address: string): LocalTag | null {
    const store = getStore();
    return store[address] || null;
}

export function setTag(address: string, tag: LocalTag | null) {
    const store = getStore();
    if (tag) {
        store[address] = tag;
    } else {
        delete store[address];
    }
    saveStore(store);
}

export function getAllTags(): Record<string, LocalTag> {
    return getStore();
}
