"""Simple measured-ToF baseline; replace policy() with your trained model."""
def policy(observation):
    front = observation.get('tof', [{}])[0]
    status, distance = front.get('status'), front.get('value')
    if status == 'out_of_range':
        left = right = 0.2
    elif status != 'ok' or distance is None:
        return {'left': 0, 'right': 0, 'brake': True, 'ttl_ms': 300}
    elif distance < 0.35:
        left, right = -0.3, 0.3
    else:
        left = right = 0.4
    return {'left': left, 'right': right, 'brake': False, 'ttl_ms': 300}
