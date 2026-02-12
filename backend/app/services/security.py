from cryptography.fernet import Fernet, InvalidToken


class TokenCipher:
    def __init__(self, key: str):
        self._fernet = Fernet(key.encode())

    def encrypt(self, raw: str) -> str:
        return self._fernet.encrypt(raw.encode()).decode()

    def decrypt(self, encrypted: str) -> str | None:
        try:
            return self._fernet.decrypt(encrypted.encode()).decode()
        except InvalidToken:
            return None
