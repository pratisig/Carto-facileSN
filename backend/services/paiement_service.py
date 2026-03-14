import requests
from config import Config

def initier_paiement_wave(telephone, montant, paiement_id):
    """
    Initie un paiement Wave Mobile Money.
    Retourne {transaction_id, checkout_url}
    Documentation: https://docs.wave.com/api
    """
    headers = {
        'Authorization': f'Bearer {Config.WAVE_API_KEY}',
        'Content-Type': 'application/json'
    }
    payload = {
        'currency': 'XOF',
        'amount': str(montant),
        'error_url': f'https://carto-facile.sn/paiement/echec/{paiement_id}',
        'success_url': f'https://carto-facile.sn/paiement/succes/{paiement_id}',
        'payment_reason': f'Export carte Carto-facileSN #{paiement_id}'
    }
    try:
        resp = requests.post('https://api.wave.com/v1/checkout/sessions',
                             json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return {
            'transaction_id': data.get('id'),
            'checkout_url': data.get('wave_launch_url')
        }
    except Exception as e:
        return {'transaction_id': None, 'checkout_url': None, 'erreur': str(e)}

def verifier_paiement_wave(transaction_id):
    """
    Vérifie le statut d'une transaction Wave.
    Retourne 'success' | 'pending' | 'failed'
    """
    headers = {'Authorization': f'Bearer {Config.WAVE_API_KEY}'}
    try:
        resp = requests.get(f'https://api.wave.com/v1/checkout/sessions/{transaction_id}',
                            headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        statut = data.get('payment_status', 'pending')
        return 'success' if statut == 'succeeded' else statut
    except Exception:
        return 'failed'
