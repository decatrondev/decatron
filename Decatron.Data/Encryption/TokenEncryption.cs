using System.Security.Cryptography;
using System.Text;

namespace Decatron.Data.Encryption
{
    public static class TokenEncryption
    {
        public static string Encrypt(string plaintext, string key)
        {
            if (string.IsNullOrEmpty(plaintext)) return plaintext;

            var keyBytes = DeriveKey(key);
            using var aes = Aes.Create();
            aes.Key = keyBytes;
            aes.GenerateIV();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var encryptor = aes.CreateEncryptor();
            var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
            var cipherBytes = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

            // IV + ciphertext → Base64
            var result = new byte[aes.IV.Length + cipherBytes.Length];
            Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
            Buffer.BlockCopy(cipherBytes, 0, result, aes.IV.Length, cipherBytes.Length);

            return "ENC:" + Convert.ToBase64String(result);
        }

        public static string Decrypt(string ciphertext, string key)
        {
            if (string.IsNullOrEmpty(ciphertext)) return ciphertext;

            // If not encrypted (legacy plaintext data), return as-is
            if (!ciphertext.StartsWith("ENC:"))
                return ciphertext;

            try
            {
                var data = Convert.FromBase64String(ciphertext.Substring(4));
                var keyBytes = DeriveKey(key);

                using var aes = Aes.Create();
                aes.Key = keyBytes;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;

                // Extract IV (first 16 bytes)
                var iv = new byte[16];
                Buffer.BlockCopy(data, 0, iv, 0, 16);
                aes.IV = iv;

                var cipher = new byte[data.Length - 16];
                Buffer.BlockCopy(data, 16, cipher, 0, cipher.Length);

                using var decryptor = aes.CreateDecryptor();
                var plainBytes = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
                return Encoding.UTF8.GetString(plainBytes);
            }
            catch
            {
                // If decryption fails, assume it's legacy plaintext
                return ciphertext;
            }
        }

        private static byte[] DeriveKey(string key)
        {
            return SHA256.HashData(Encoding.UTF8.GetBytes(key));
        }
    }
}
